# Senior Connect Platform — Backend API

## What this project is
Backend REST API (NestJS + TypeScript + MongoDB/Mongoose) for the **Senior Connect / Activity Together** platform:
- **Mobile App** (Figma: `Senior Connect - Mobile App.fig`) — users discover, create, and join local activities.
- **Admin Dashboard** (Figma: `Senior Connect - Admin Dashboard.fig`) — admins manage users, approve activities, manage categories, and send notifications.

## Repository layout
```
giova_cass/
├── CLAUDE.md                  ← this file
├── docs/
│   ├── SRS.md                 ← Software Requirements Specification
│   ├── ER-DIAGRAM.md          ← Mermaid ER diagram
│   └── BACKEND-REFACTOR-PLAN.md ← phased plan + status; READ FIRST when resuming backend work
├── postman/
│   └── Senior-Connect-API.postman_collection.json
├── *.fig                      ← Figma source designs (source of truth for field names)
├── senior-connect-api/        ← NestJS backend
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/            ← mongoose + app config
│       ├── common/            ← guards, decorators, filters, interceptors, enums, utils
│       └── modules/<name>/    ← one folder per feature module
└── senior-connect-dashboard/  ← React admin dashboard (Vite + TS + Redux Toolkit/RTK Query)
```

## Backend module pattern (MANDATORY — NestJS-standard layout, every feature module)
```
src/modules/<module>/
├── <module>.module.ts         ← Nest module wiring
├── <module>.controller.ts     ← HTTP layer only (no business logic)
├── <module>.service.ts        ← business logic + Mongoose model access
├── <module>.routes.ts         ← route path constants (single source for URLs)
├── dto/                       ← class-validator DTOs, one class per file + index.ts barrel
│   ├── <action>.dto.ts
│   └── index.ts
├── schemas/                   ← Mongoose schemas, one class per file + index.ts barrel
│   ├── <name>.entity.ts
│   └── index.ts
└── interfaces/                ← TypeScript interfaces (service contracts, responses)
    └── <module>.interface.ts
```
Modules: `auth`, `users`, `categories`, `activities`, `participants`, `favorites`, `notifications`, `dashboard`, `uploads`.
`uploads` has no schemas (files live on disk); its filter/limits constants live in `uploads.constants.ts` (Nest CLI would normally call this `dto`, but there's no request body to validate here).
Import DTOs/schemas via the barrel: `from './dto'`, `from './schemas'`, cross-module `from '../categories/schemas'`.
Each module registers its schemas with `MongooseModule.forFeature([{ name: X.name, schema: XSchema }])`; services inject them with `@InjectModel(X.name)`.

## Field naming — FIGMA IS THE SOURCE OF TRUTH (must)
Every API/DTO/entity field name is the camelCase form of the label in the Figma designs.
Do NOT rename or "improve" them. Canonical dictionary:

| Figma label | Field name |
|---|---|
| First Name | `firstName` |
| Last Name | `lastName` |
| Your Email / Email Address | `email` |
| Password | `password` |
| Phone number | `phoneCountryCode` + `phoneNumber` (the field has a country selector); `phoneE164` is the derived canonical form and the login identifier |
| Date of birth | `dateOfBirth` |
| Language | `language` |
| Country / Region / City | `country` / `region` / `city` |
| Profile Photo | `profilePhoto` |
| What are you doing? (Activity name) | `activityName` |
| Category / Category name | `categoryName` (entity), `categoryId` (FK) — no icon field, name only |
| Descriptions | `descriptions` (plural — as in Figma) |
| Maximum number of participants | `maximumNumberOfParticipants` |
| Activity Photo | `activityPhoto` |
| Activity Date | `activityDate` |
| Activity Time | `activityTime` |
| Activity Duration | `activityDuration` |
| Activity Equipment | `activityEquipment` |
| Activity Location | `activityLocation` |
| Participant Age Range | `minAge` / `maxAge` (range bounds) |
| Price | `price` |
| Difficulty | `difficulty` |
| Organizer | `organizer` (relation), `organizerId` |
| Notification Title | `notificationTitle` |
| Message Content | `messageContent` |
| Audience | `audience` (`Everyone` \| `Interests`) + `audienceCategoryIds`; `Seniors`/`Volunteers` retired in Phase 7 |
| Sent Date | `sentDate` |
| Current/New/Confirm Password | `currentPassword` / `newPassword` / `confirmPassword` |
| Date Format | `dateFormat` |
| Notification Sounds | `notificationSounds` |
| Member since | `memberSince` (users.createdAt exposed as memberSince) |
| Status values (user) | `Active` \| `Inactive` \| `Suspended` \| `Blocked` \| `Pending` |
| Status values (activity) | `Draft` \| `Pending` \| `Approved` \| `Rejected` \| `Cancelled` \| `Completed` |
| Status values (category) | `Active` \| `Disabled` \| `Pending` (user-proposed, awaiting review) |
| Status values (notification) | `Delivered` \| `Failed` |

## Conventions
- **TypeScript strict**, Node ≥ 20, NestJS 10, Mongoose 8, MongoDB 7.
- Global prefix `api/v1`. Mobile endpoints under module root; admin-only endpoints under `/admin/...` inside the same module or protected with `@Roles(UserRole.ADMIN)`.
- Response envelope everywhere: `{ "success": boolean, "message": string, "data": ... }` (+ `meta` for paginated lists: `{ page, limit, total, totalPages }`).
- Auth: JWT access (`Authorization: Bearer`) + refresh token; passwords bcrypt-hashed; OTP for verification/reset (6 digits, 5 min TTL).
- **Dual identity.** Email and phone are both login identifiers. Register, login, verify-otp, resend-otp, forgot-password and reset-password each take exactly one of `email` or `phoneCountryCode` + `phoneNumber` (or `phoneE164`); registration accepts both. Admin login is email-only.
- OTP transports are registered with `OtpDeliveryService` by `OtpChannel`; `AuthService` never names nodemailer or Twilio. A third provider is a class implementing `OtpTransport` plus one line in that registry.
- Validation via `class-validator` DTOs in `<module>/dto/*.dto.ts` with global `ValidationPipe({ whitelist: true, transform: true })`.
- DB naming: collections are snake_case via an explicit `collection:` on each `@Schema`; document fields stay camelCase, matching the API surface.
- Env config in `.env` (see `.env.example`). Never commit `.env`.

## Commands
```bash
cd senior-connect-api
npm install
npm run build         # tsc (strict) → dist/
npm run seed          # creates 13 Figma categories + admin (admin@contenthub.io / admin123)
npm run db:sync-indexes  # reconcile indexes; REQUIRED once on a pre-Phase-2 database
npm run test:all      # 51 endpoint + 24 phone + 34 home + 29 category + 27 moderation + 24 ring + 32 targeting checks + 2 concurrency tests
npm run start:dev     # ts-node
npm run start:prod    # node dist/main.js
```

## Database (dev)
MongoDB runs via **Docker Compose** (`senior-connect-api/docker-compose.yml`) as a **single-node replica set** — port 27017 on this host is already taken by another project, so Arooby uses **27018**:
```bash
cd senior-connect-api
docker compose up -d       # starts MongoDB 7 in container "arooby-db" on port 27018
docker compose ps          # healthcheck initiates rs0 on first boot, then reports healthy
docker compose down        # stop (add -v to also wipe the data volume)
```
Reads `DB_HOST`/`DB_PORT`/`DB_DATABASE` from `.env` (defaults: `localhost`/`27018`/`arooby`); set `MONGODB_URI` instead to point at Atlas. Data persists in the named volume `arooby-db-data`.

**The replica set is not optional.** Standalone `mongod` has no multi-document transactions, and the join-activity path relies on atomic conditional updates plus the option of a transaction. Never "simplify" the compose file back to a plain `mongod`.

## Deliberate departures from the Figma
- **Password length.** The Reset Password screen says "6-8 characters". The maximum is *not* enforced — an 8-character ceiling makes strong passwords impossible (the seeders' own `password123` would have been invalid). Minimum 6 is kept; there is no maximum.
- **OTP length.** The mobile frames draw 5 boxes; the API issues and validates **6** digits.

## Gotchas learned in this repo
- Ids are Mongo `ObjectId`s. Route params take `ParseObjectIdPipe` and body/query fields take `@IsObjectId()` — never `ParseUUIDPipe` / `@IsUUID()`, which silently reject every real id.
- Never pass an unvalidated string to `findById`: use `toObjectId()` from `common/schema.helpers` and turn `null` into a 404, or Mongo throws a CastError that surfaces as a 500.
- `timestamps: true` supplies `createdAt`/`updatedAt` at runtime, but TypeScript cannot see them — every schema class declares both explicitly.
- A nested GeoJSON `@Prop` cannot express "absent by default"; use the shared `GeoPointSchema` sub-schema, or an empty object gets written and the 2dsphere index rejects it.
- `activity.joinedCount` is **denormalised**. Only change it through the atomic `$inc` paths in `participants.service.ts` — a plain read-then-write oversubscribes activities under concurrent joins.
- In `join()`, the participant upsert filter **must** keep `status: { $ne: Joined }`. It is what forces a duplicate-key error when a second in-flight request for the same user arrives; without it the upsert quietly re-sets an existing row and every concurrent request keeps the seat it claimed, permanently inflating `joinedCount`.
- `ParticipantStatus.Removed` (organizer ejected them) must bar re-joining, and `Cancelled` (they left) must not. The bar is enforced twice in `join()`: a 403 on the read, and `Removed` in the upsert's `$nin` — without the second, a read racing a removal flips the ejected row back to `Joined`.
- Removing a participant is **not** a block. A personal block is bidirectional and account-wide via `visibilityFilter`; never add one as a side effect of an activity-scoped action.
- Mongo has no cascading delete. Deleting an activity must also delete its participants and favorites (see `deleteWithDependents`).
- `process.env` is read at decorator-evaluation time in `app.module.ts`, so `main.ts` starts with `import 'dotenv/config'`.
- Dev OTPs are not delivered unless the provider is configured — they are logged to the server console (`[DEV] OTP for <identifier>`). Email needs `SMTP_*`, SMS needs `TWILIO_*`; both fall back to logging.
- Never store an un-normalised phone number. `phoneE164` carries the unique index, and `phoneCountryCode`/`phoneNumber` are only the Figma display split — "+41"/"079…" and "+41"/"79…" are the same subscriber. Normalise with `resolvePhone()` from `common/utils/phone.util`.
- `email` and `phoneE164` are unique via **partial** indexes (`$type: 'string'`), not `sparse`. Sparse only skips *absent* fields and Mongoose writes an explicit `null`, so a plain unique index would allow exactly one phone-only account to exist. Changing index options needs `npm run db:sync-indexes` — Mongo will not rebuild in place, and `autoIndex` logs the conflict rather than failing the boot.
- A suite failing at `== setup ==` with no other output usually means the OTP per-IP cap is exhausted, not that the code broke — a full `test:all` registers ~23 accounts from one host. The dev `.env` raises only `OTP_{EMAIL,SMS}_MAX_PER_IP_{HOUR,DAY}`; never raise the cooldown or the per-identifier budgets, which the phone suite asserts on.
- OTP rate limits count `otp_request_logs`, never `otps`. OTP rows are consumed and TTL-reaped, so counting them would let an attacker refill their own budget by letting codes expire. SMS costs real money — do not relax the per-IP caps.
- Editing a phone through `PATCH /users/me` must re-derive `phoneE164` and clear `isPhoneVerified`, or the account keeps signing in with its old number while claiming one it never proved.
- `@Public()` routes still decode a bearer token when one is offered, so `@OptionalUser()` works on them. A missing or invalid token is ignored there, never rejected.
- Literal routes must be declared **before** `:id` in a controller — Nest matches in declaration order, so `/activities/summary` would otherwise hit the details handler and be parsed as an ObjectId.
- `$near` cannot go into `countDocuments`: the driver runs it as an aggregation `$match`, which rejects the operator. Sort by distance with `$near` in the `find` and count the same radius with `$geoWithin` + `$centerSphere` (see `discover`), or every paginated geo query throws.
- Autocomplete (`/activities/suggestions`) deliberately does **not** use the `activityName` text index — text indexes match whole words, so "swi" would never match "Swimming".
- Notification audiences are `Everyone` or `Interests` + `audienceCategoryIds`. `Seniors`/`Volunteers` were removed because nothing on the user document could resolve them — every such broadcast silently went to everyone. Existing databases need `npm run db:migrate-audience` once.
- Category approval is **non-blocking**. A `Pending` category is excluded from the public `GET /categories` chips but still renders on the activity that proposed it — activity lookups resolve a category by id regardless of status, and must keep doing so. Rejecting sets `Disabled`; never delete a category an activity points at.
- Bound every numeric query param that reaches a geo operator. `maxDistance` needs `@Min(0)` and coordinates need `@Min(-90)/@Max(90)` and `@Min(-180)/@Max(180)`, or Mongo throws inside `$centerSphere`/`$maxDistance` and the raw driver message surfaces as a 500 — the same failure mode as passing an unvalidated string to `findById`.

## Postman
`postman/Senior-Connect-API.postman_collection.json` — import into Postman. Contains every endpoint with request body + example response, organized by module. `{{baseUrl}}` = `http://localhost:5000/api/v1`, `{{accessToken}}` auto-captured by login request test script.
