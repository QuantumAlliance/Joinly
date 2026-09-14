# Arooby — Backend Refactor Plan

Living plan for bringing `senior-connect-api` in line with the mobile Figma
designs and moving it onto MongoDB. **Update the status table as phases land**
so any session can pick up from here without re-deriving context.

- **Design source (mobile):** `Mobile App Design/*.svg` — `Section 2.svg` is the
  full sitemap; the individual `iPhone 13 & 14 - *.svg` files are the auth and
  onboarding screens.
- **Design source (admin):** `Dashboard figma design/*.svg`. Read colours from
  the `<linearGradient>` stops as well as the flat `fill` attributes — the
  primary accent is a gradient and does not appear as a flat fill.
  **Do not colour-match against `senior-connect-dashboard/dashboard figma/*.png`**;
  those are a stale all-green export.
- **Project rules:** `CLAUDE.md` (kept in step with this plan).

---

## Status

| Phase | Scope | State |
|---|---|---|
| **0** | MongoDB + Mongoose migration | ✅ **Done** — 51/51 endpoint checks, 2 concurrency tests, build clean |
| **1** | Contract corrections | ✅ **Done** — password cap, upload cap, terms timestamp, dial code |
| **2** | Dual-identity auth (email + phone via Twilio) | ✅ **Done** — 24 phone checks, 51 endpoint checks, 2 concurrency tests |
| **3** | Home & discovery endpoints | ✅ **Done** — 34 home checks, sort modes, hero count, autocomplete, badge, geo input bounds |
| **4** | Categories with non-blocking approval | ✅ **Done** — 29 category checks, Pending queue, approve/reject |
| **5** | Participant moderation | ✅ **Done** — 27 moderation checks, seat release verified under concurrency |
| **6** | Profile completeness | ✅ **Done** — 24 ring checks, derived from existing fields |
| **7** | Notification targeting | ✅ **Done** — 32 targeting checks, interest segments, legacy rows migrated |
| — | Google sign-in | ⏸ Deferred, not scheduled |

---

## Decisions (locked — do not relitigate)

| Question | Decision |
|---|---|
| OTP length | **6 digits.** The frames draw 5 boxes; treated as approximate. |
| Password rules | **Minimum 6, no maximum.** The design's 6–8 cap is deliberately not enforced. |
| User-created categories | **Approval queue, non-blocking.** The activity publishes immediately with its new category; approval only decides whether the category joins the public chips for everyone else. |
| Notification audience | Replace `Seniors` / `Volunteers` with **interest targeting** — `Everyone`, or a set of category ids. Those are the only segments the data can resolve. |
| Sign-in methods | **Email _and_ phone, both mandatory.** Twilio for SMS OTP. Google deferred. |
| Database | **MongoDB + Mongoose.** Single-node replica set. Postgres data treated as disposable. |

---

## Running it

```bash
cd senior-connect-api
docker compose up -d          # MongoDB 7, single-node replica set, port 27018
npm install
npm run seed                  # 13 categories + admin@contenthub.io / admin123
npm run seed:demo             # 12 users, 16 activities, 8 notifications
npm run db:sync-indexes       # required once after Phase 2 on an existing database
PORT=4500 npm run start:dev
npm run test:all              # 51 endpoint + 24 phone + 34 home + 29 category + 27 moderation + 24 ring + 32 targeting checks + both concurrency tests
```

`db:sync-indexes` is not optional on a database created before Phase 2. The old
plain-unique `users.email_1` treats every `null` as a colliding value, so
exactly one phone-only account could ever exist; the script drops it for the
partial unique index the schema now declares. Safe to re-run.

Port 27018, not 27017 — 27017 is taken by another project on this machine.
`MONGODB_URI` overrides the discrete `DB_*` vars if you point at Atlas.

**The replica set is not optional.** Standalone `mongod` has no multi-document
transactions and the join path depends on atomic conditional updates.

### Running the harness repeatedly

A full `test:all` registers ~23 accounts from one host, and the shipped OTP
per-IP caps (100 email, 15 SMS per hour) allow only a few runs an hour before
setup starts returning 429. The dev `.env` therefore raises **only the per-IP
caps**:

```
OTP_EMAIL_MAX_PER_IP_HOUR=2000
OTP_SMS_MAX_PER_IP_HOUR=2000
```

The 60-second cooldown and the per-identifier budgets are left alone — the
phone suite asserts on the cooldown, so raising it would delete a check rather
than pass it. The defaults in `auth.constants.ts` are untouched and are what a
deployed environment uses. **Do not copy these overrides into production.**

If a suite fails at `== setup ==` with nothing else printed, check the caps
before suspecting the code:

```bash
docker exec arooby-db mongosh arooby --quiet   --eval "print(db.otp_request_logs.countDocuments({createdAt:{\$gt:new Date(Date.now()-3600000)}}))"
```

### Regression harness

| Script | What it proves |
|---|---|
| `scripts/smoke.sh` | 51 checks across every module — auth, guards, categories, users, activities, participants, favorites, notifications, dashboard, contact |
| `scripts/smoke-phone.sh` | 24 checks on dual-identity auth — phone-only registration, both login paths, normalisation, linking, rate limiting, SMS password reset |
| `scripts/smoke-categories.sh` | 29 checks on user-created categories — proposal, non-blocking publish, the wizard seam, review queue, approve/reject, guards |
| `scripts/smoke-home.sh` | 34 checks on Home & discovery — three sort modes, hero count and its radius, autocomplete, bell badge, and that bad geo input is a 400 rather than a 500 |
| `scripts/smoke-moderation.sh` | 27 checks on participant moderation — organizer-only removal, seat release, the re-join bar, and 5 concurrent removals releasing exactly one seat |
| `scripts/smoke-completeness.sh` | 24 checks on the profile completeness ring — step shape and order, each step moving the percentage, GPS-only location, and that the ring is derived rather than stored |
| `scripts/smoke-targeting.sh` | 32 checks on notification targeting — the retired audiences, audience/target agreement, segment delivery and exclusion, one copy per user, empty segments, Everyone |
| `scripts/race-capacity.sh` | 6 users rushing a 2-seat activity → exactly 2 admitted |
| `scripts/race-same-user.sh` | 1 user firing 5 simultaneous joins → exactly 1 seat consumed |

Run these after every phase. They are the contract that the port did not change
behaviour.

---

## Phase 0 — MongoDB migration ✅

TypeORM/Postgres → Mongoose/MongoDB. Pure port; no behaviour changes.

- 11 entities → schemas (`modules/*/schemas/`), 26 relations → `ObjectId` refs
- 14 QueryBuilder sites → `find`/`aggregate`; 2 raw SQL aggregations → `$group`
- JS Haversine filter → **`$geoWithin` + `2dsphere` index** (now indexed, was a full scan)
- `docker-compose.yml` → MongoDB 7 replica set, self-initiating via healthcheck
- Both seeders ported; `CLAUDE.md` rewritten off Postgres

**Four bugs found by testing after the port, all fixed:**

1. **Seat leak on same-user concurrent join.** The participant upsert filtered
   on `{activityId, userId}`, matched an already-Joined row and re-set it, so
   every in-flight request kept its claimed seat. 5 concurrent joins from one
   user gave `joinedCount = 3` against 1 membership row. Fixed by adding
   `status: { $ne: Joined }` — see the gotcha in `CLAUDE.md`.
2. **`my-notifications` lost its ordering.** Sorted by the delivery row's
   `createdAt`, which is identical across a fan-out batch. Now an aggregation
   sorting on the broadcast's `sentDate`.
3. **`discover` leaked past activities.** An explicit `activityDate` overwrote
   the upcoming-only guard. Conditions now stack in `$and`.
4. **Duplicate interest ids returned 500.** `insertMany` hit the unique index;
   ids are de-duplicated first.

---

## Phase 1 — Contract corrections ✅

| Change | Where |
|---|---|
| Password: `@Length(6,8)` → `@MinLength(6)`, no maximum | `auth/dto/{register,reset-password,change-password}.dto.ts` |
| Upload cap 5 MB → 25 MB | `uploads/uploads.constants.ts` |
| `acceptedTermsAt` persisted on registration | `users/schemas/user.schema.ts`, `auth.service.ts` |
| `phoneCountryCode` split from `phoneNumber` | user schema, register + update-profile DTOs, `UserProfile` |

The password cap mattered on its own: at 6–8 characters the seeders' own
`password123` could never have been registered through the API.

---

## Phase 2 — Dual-identity auth ✅

Phone is a login identifier now, not a profile field.

| Change | Where |
|---|---|
| Twilio SMS transport, dev fallback logs the code | `common/services/sms.service.ts` |
| Channel registry `AuthService` talks to instead of a provider | `common/services/otp-delivery.service.ts`, `otp-transport.interface.ts` |
| `phoneE164` (unique) + `isPhoneVerified` | `users/schemas/user.schema.ts` |
| OTPs key on `identifier` + `channel`, not `email` | `auth/schemas/otp.schema.ts` |
| `POST /auth/phone/request-otp`, `POST /auth/phone/verify` | `auth.controller.ts`, `auth.routes.ts` |
| `OtpType` gains `VerifyPhone` and `PhoneLogin` | `common/enums` |
| Every entry point takes either identifier | `auth/dto/identifier.dto.ts` |
| Rate limiting: cooldown, per-identifier and per-IP hourly + daily | `auth/otp-rate-limiter.service.ts`, `auth.constants.ts` |
| Optional auth on public routes (`@OptionalUser()`) | `common/guards/jwt-auth.guard.ts` |

**Decisions taken while building:**

- **`phoneE164` is the identifier; the Figma split stays the display surface.**
  Neither `phoneCountryCode` nor `phoneNumber` is unique on its own, and
  "079 123 45 67" and "79 123 45 67" are the same subscriber. Normalising into
  one E.164 string is what makes the unique index mean anything. No
  libphonenumber: it buys per-country length rules for ~150 kB of metadata that
  "one subscriber, one row" does not need.
- **`email` became nullable**, with a *partial* unique index rather than
  `sparse`. Sparse only skips absent fields, and Mongoose writes an explicit
  `null`; without the partial filter exactly one phone-only account could
  exist. Same treatment for `phoneE164`.
- **Account linking.** A number verified against another account is a 409. A
  number merely *claimed* by an unverified account is released to whoever
  proves it — proof beats a claim.
- **`request-otp` refuses an unknown number** unless the caller is signed in
  and linking. Sending to any number a stranger names is an SMS-bombing
  endpoint pointed at third parties and billed to this project.
- **Password reset works over SMS.** Once registration can start from a phone
  alone, an email-only reset path strands those accounts permanently.
- **Login is gated per identifier.** A verified email does not make an
  unverified number a usable login, or proving the number would mean nothing.
- **Admin login stays email-only.** Admin access should not be reachable
  through the SMS flow.
- Editing a phone through `PATCH /users/me` re-derives `phoneE164` and clears
  `isPhoneVerified` — otherwise the account keeps signing in with the old
  number while claiming a new one it never proved.

**Rate limits** (`OTP_RATE_LIMITS`, all overridable from `.env`):

| | cooldown | per identifier / h | / day | per IP / h | / day |
|---|---|---|---|---|---|
| Email | 60 s | 5 | 15 | 100 | 300 |
| SMS | 60 s | 3 | 10 | 15 | 40 |

Counted from `otp_request_logs`, never from `otps` — OTP rows are consumed and
TTL-reaped, so counting them would let an attacker refill their own budget by
letting codes expire. The per-IP half is the one that matters: a per-number cap
alone still lets one host walk a block of numbers a message at a time.

**Still open:** Twilio credentials. Everything above is built and tested
against the dev fallback, which logs the code instead of sending it. Set
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and either `TWILIO_FROM_NUMBER` or
`TWILIO_MESSAGING_SERVICE_SID` in `.env` and live sending turns on with no code
change.

Closes: *phone sign-in missing* (blocking).

## Phase 3 — Home & discovery ✅

Everything the Home tab needs that `discover` did not already do.

| Change | Where |
|---|---|
| `sort=nearby\|popular\|recent` on discover | `activities.service.ts` — `sortFor()`, reinstated from Phase 0 |
| `GET /activities/summary` — hero banner count | `activities.service.ts` — `summary()` |
| `GET /activities/suggestions?q=` — autocomplete | `activities.service.ts` — `suggestions()` |
| `GET /notifications/unread-count` — bell badge | `notifications.service.ts` — `unreadCount()` |

**Decisions taken while building:**

- **`nearby` uses `$near`, not an explicit sort.** `$near` already returns
  documents nearest-first off the 2dsphere index; sorting on top of it would
  discard that ordering and force an in-memory sort of the whole match. The
  method therefore returns an *empty* sort for this mode.
- **`$near` never reaches `countDocuments`.** The driver runs that count as an
  aggregation `$match`, which rejects `$near` outright — pagination would have
  thrown on every nearby request. The find gets `$near`; the count keeps the
  `$geoWithin` form of the same radius, so `meta.total` still matches the rows.
  There is a regression check on exactly this.
- **`nearby` without coordinates is a 400**, not a silent fallback. There is no
  honest origin to measure from, and quietly returning a chronological list
  under a "nearby" label is worse than refusing.
- **Autocomplete does not use the `activityName` text index.** A text index
  matches whole words, so typing "swi" returns nothing for "Swimming" — the one
  thing an autocomplete must do. A case-insensitive substring regex over the
  already-narrow candidate set (approved + upcoming, capped result) is the
  correct trade here.
- **`summary` reports `radiusKm: null` when no location is known**, rather than
  passing a national count off as "near you". The banner needs to be able to
  word itself honestly.
- **`unread-count` is its own endpoint**, not a field on the list response. The
  badge is polled far more often than the list is opened and should not pay for
  the `$lookup` that joins each delivery row to its broadcast.
- `summary` and `suggestions` are declared **above** `:id` in the controller.
  Nest matches in declaration order, so the param route would otherwise swallow
  them and try "summary" as an ObjectId.

**Bug found while finishing the phase — unvalidated geo query params.**
`maxDistance` and `latitude`/`longitude` reached `$centerSphere` / `$maxDistance`
unaltered, so a negative radius or an out-of-range coordinate made Mongo throw
and the raw driver message surfaced as a **500** (`"Radius must be a
non-negative number: -0.0007848…"`). Present on `discover` since Phase 0 and
inherited by both new endpoints. `create-activity` and `update-location`
already bounded their coordinates; `update-activity`, `discover` and the new
`summary` did not. All three now do, and `suggestions.limit` is bounded to the
same cap the service clamps to. Nine regression checks cover it.

Closes: *3 home feeds* (blocking), *autocomplete*, *hero count*, *bell badge*.

## Phase 4 — Categories with non-blocking approval ✅

| Change | Where |
|---|---|
| `CategoryStatus` gains `Pending` | `common/enums` |
| `POST /categories` for any authenticated user, created as `Pending` | `categories.service.ts` — `suggest()` |
| `proposedBy` on the category, resolved into a name for the queue | `schemas/category.schema.ts`, `adminList()` |
| Public `GET /categories` still returns `Active` only | `listActive()` — unchanged, and now covered by a test |
| Admin `status=Pending` filter + `stats.pendingReview` | `adminList()` |
| `PATCH admin/categories/:id/status` — approve / reject | `updateStatus()` |
| The wizard seam now creates `Pending`, not `Disabled` | `activities.service.ts` `create()` |

**Decisions taken while building:**

- **Rejection disables, never deletes.** The activity that introduced the
  category still points at it and still has to render its name. Deleting would
  break that activity's card in order to tidy up a chip list.
- **`Pending` was the wrong thing to reuse `Disabled` for.** The pre-Phase-4
  seam created user-proposed categories as `Disabled`, which is
  indistinguishable from a category an admin deliberately retired — there was
  no way to build a review queue out of it. That is the whole reason the enum
  needed a third value.
- **Proposing an existing name returns the existing row rather than a 409.**
  The user asked for a category by that name and one exists, so handing it back
  answers the request; a conflict would only push the client into re-searching
  for a row the endpoint is already holding. The admin "Add Category" path
  keeps its 409, because there the duplicate is a mistake worth reporting.
- **Review will not accept `Pending`.** Review is a decision; putting a row back
  into the queue it just left is not one, so `{ status: "Pending" }` is a 400.
- **Approve/reject is its own endpoint**, mirroring
  `admin/activities/:id/status`. The generic `PATCH admin/categories/:id` still
  accepts a status for renaming flows and was left alone — changing it would
  have broken the dashboard for no gain.
- **`proposedBy` is null for seeded and admin-added rows.** The queue needs to
  show who is waiting on a decision, and nobody is waiting on a category an
  admin added themselves.

The `difficulty` question that was parked in this phase is answered below and
needed no backend work.

- [x] **`difficulty` — decided: keep it, no API change needed.** The claim that
      it "is never collected" was wrong: `CreateActivityDto` and
      `UpdateActivityDto` have both accepted an optional `difficulty` since
      Phase 0, and `create()` defaults it to `Beginner`. The gap is purely that
      the Figma Create wizard draws no control for it — a client concern, not a
      backend one. Dropping it from Details would have deleted a documented
      Figma field to fix a problem the API does not have.

Closes: *user-created categories* (blocking).

## Phase 5 — Participant moderation ✅

| Change | Where |
|---|---|
| `ParticipantStatus` gains `Removed` | `common/enums` |
| `DELETE /participants/activities/:activityId/participants/:userId` | `participants.service.ts` — `remove()` |
| Seat released through the same `releaseSeat()` path as `leave()` | `remove()` |
| `Removed` bars re-joining | `join()` |

**Decisions taken while building:**

- **Removal is not a block — they stay separate endpoints.** A personal block is
  bidirectional and account-wide: `visibilityFilter` hides activities in *both*
  directions, so silently blocking on removal would hide every one of the
  organizer's activities from that user, and theirs from the organizer, forever.
  That is an enormous consequence for "remove from this event", it is invisible
  to whoever clicked it, and un-removing would not undo it. A client offering
  "Remove and block" makes two calls; each action keeps its own name and its own
  undo. Tested both ways: removal leaves the block list empty, and the removed
  user can still see the activity.
- **`Removed` had to be its own status, and it had to bar re-joining.** Reusing
  `Cancelled` would have let an ejected participant press Join again and take
  the seat straight back, which makes removal decorative. `Cancelled` still
  allows re-joining — that is a voluntary leave, and there is a test for each.
- **The re-join bar is enforced twice.** A friendly 403 on the read, *and*
  `Removed` excluded from the upsert filter in `join()`. Without the second, a
  read racing a removal would let the upsert quietly flip an ejected row back to
  `Joined`; with it, that path insert-fails on the unique index and the seat is
  handed back — the same mechanism the same-user concurrency guard relies on.
- **Only a currently-`Joined` row transitions**, in one atomic update, exactly
  as `leave()` does. A repeated removal is a 404, not a second decrement.
  Verified with five simultaneous removals releasing exactly one seat.
- **Organizer-only, admins included.** An admin removing someone from a stranger's
  activity is account moderation, and the admin already has activity-level
  controls for that. This endpoint is the organizer's.
- **No re-admit endpoint.** Removal is final for that activity. Adding an undo
  was not in scope, and a client can create the invitation flow it needs on top
  of the existing join path if that changes.

Closes: *organizer cannot remove a participant* (blocking).

## Phase 6 — Profile completeness ✅

Pure derivation from existing fields; no schema change, as planned.

- `GET /users/me/completeness` → `{ percentage, completed, total, steps: [{ key, label, done }] }`
- Steps, in the order the frame draws them: `name`, `interests`, `location`,
  `profilePhoto`

**Decisions taken while building:**

- **Equal weights.** A ring with weighted segments would need the weights
  published for the client to render it honestly, and the design has no such
  thing. Four steps, 25% each.
- **`interests` is satisfied by one, not three.** The "select at least 3" rule
  belongs to the onboarding form that writes them. A ring that called a user
  with one interest "not done" would be reporting on a rule they have already
  moved past.
- **`location` accepts either half of what `updateLocation` accepts** — a typed
  country/region/city *or* coordinates. Demanding both would mark a GPS user
  incomplete for using the permission prompt exactly as designed. Tested both
  ways.
- **`name` is kept even though it is always true.** Both halves are required at
  registration, so the step never reads false today. It stays because the frame
  draws it, and it is the one that would start reading false if a social
  sign-in ever created an account without a name.
- **`completed` and `total` are returned alongside `percentage`.** The frame
  shows "3 of 4" next to the ring, and making the client re-derive that from an
  array it just received is pointless.

Nothing is stored: there is a check that clearing `profilePhoto` directly in the
database moves the ring back, so the figure can never drift from the fields it
describes.

Closes: *profile completeness ring*.

## Phase 7 — Notification targeting ✅

| Change | Where |
|---|---|
| Audience becomes `Everyone` or a set of category ids | `common/enums`, `notification.schema.ts` |
| Fan-out resolves recipients from user interests | `notifications.service.ts` — `resolveRecipients()` |
| Admin Audience column renders the category names | `senior-connect-dashboard/src/pages/Notifications.tsx` |
| Legacy `Seniors` / `Volunteers` rows migrated | `src/migrate-audience.ts` (`npm run db:migrate-audience`) |

**Decisions taken while building:**

- **`Seniors` and `Volunteers` were deleted, not kept as dead values.** Nothing
  on the user document ever distinguished a senior from a volunteer, so neither
  could resolve into a recipient list: every broadcast carrying one was in fact
  delivered to every active mobile user, and only the history column claimed
  otherwise. Keeping them would preserve a label that lies.
- **Historic rows are rewritten to `Everyone`, not to a guessed segment.**
  `Everyone` is what actually happened. Inventing categories for a past
  "Seniors" broadcast would fabricate a targeting decision nobody made.
- **The two halves of the request must agree.** `Interests` with no categories
  is a 400, and `audienceCategoryIds` on an `Everyone` broadcast is a 400.
  Ignoring stray ids would look like targeting that silently did nothing; an
  empty segment would report success and reach no one.
- **Every targeted category must exist.** A broadcast aimed at an id resolving
  to nothing would be indistinguishable from a genuinely empty segment.
- **`recipientCount` was added.** With segments, "Delivered" alone cannot tell a
  broadcast that reached six hundred people from one whose segment matched
  nobody. The count is recorded at send time and shown under the Audience chips.
- **An empty segment is `Delivered`, not `Failed`.** Nothing broke — the
  audience is simply empty, and `Failed` is reserved for a fan-out that threw.
- **Category *ids* are stored, not names**, so renaming a category keeps history
  accurate; the admin list resolves them for display. A category deleted later
  is dropped from the chip list rather than rendered blank.
- **A user matching several targeted categories gets one copy.** `distinct` on
  `userId` collapses them before insert — the unique index would reject the
  duplicate anyway.

**Migration:** `npm run db:migrate-audience` rewrites legacy audiences and
backfills `recipientCount` from the delivery rows each broadcast already has.
Run once per environment; it is idempotent, and was run against dev (3 legacy
rows rewritten, 40 rows backfilled).

Closes: *audience taxonomy resolves nothing*.

---

## Deferred — Google sign-in ⏸

The welcome screen draws "Continue with Google" and this plan does not deliver
it. Needs Google token verification, a `provider` concept on the user document,
and a rule for a Google email that already has a password account.
Independently shippable once Phase 2's identity model exists.

---

## Deliberate departures from the Figma

Recorded so they do not get "fixed" back. Also in `CLAUDE.md`.

- **Password length** — the design says 6–8; the maximum is not enforced.
- **OTP length** — the design draws 5 boxes; the API uses 6 digits.
- **Admin page titles** — Categories, Notifications and both detail screens draw
  their title in green; the dashboard renders every title blue, treating the
  green as a leftover from the recolour.

## Known gaps not yet scheduled

- Design shows a **map thumbnail** on Activity Details Location card; no field
  supplies it (`mapImage` exists only in the dashboard's mock layer).
- Admin dashboard's **search field** in the topbar is decorative — accepts text,
  wired to nothing.
- `Difficulty` is accepted by the API (optional, defaults to `Beginner`) but the
  Figma Create wizard draws no control for it, so every activity created through
  the current mobile flow reads "Beginner". Client-side gap.
