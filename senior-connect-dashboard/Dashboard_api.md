# Dashboard ↔ API integration — issues found and fixed

Findings from running the admin dashboard against the **live** NestJS API
(`http://localhost:5000/api/v1`, MongoDB Atlas `giova_cass`) with the real seeded
admin account, plus a contract check of every endpoint the RTK Query slice calls.

**Contract check: every endpoint the dashboard calls returns exactly the shape
`src/app/api/types.ts` promises** — 26 before this pass, 35 after the newly wired ones.
No field is missing, misnamed or of the wrong type, so **the API itself has no defects
here**. Every problem below is on the dashboard side: endpoints the API exposes that the
dashboard never called, or responses it did not handle.

Verification commands used throughout:

```bash
node <job>/tmp/verify-dashboard.js   # 26 endpoints vs. the TypeScript contract
node <job>/tmp/drive.js              # Playwright: every screen + flow, live API
npm run build                        # tsc -b && vite build
```

---

## To do

- [x] **1. The dashboard never talked to the API at all.** `USE_MOCKS` is true whenever
  `import.meta.env.DEV` is set and `VITE_USE_MOCKS` is not the exact string `"false"`,
  and the repo shipped no `.env`. So `npm run dev` served the in-memory backend in
  `src/mocks` and every screen looked healthy against fake data. This is why none of
  the problems below had surfaced.
  *Fix:* add `.env` (`VITE_API_URL`, `VITE_USE_MOCKS=false`) and `.env.example`, and
  invert the default so mocks are strictly opt-in via `VITE_USE_MOCKS=true`.

- [x] **2. A 401 leaves the admin staring at an empty dashboard.** With an expired or
  invalid access token the app stays on `/dashboard` and renders `TOTAL USERS 0`,
  `TOTAL ACTIVITIES 0` while four API calls fail with
  `401 {"success":false,"message":"Invalid or expired access token"}`. Nothing logs the
  admin out and nothing tells them why the screen is empty.
  *Fix:* a `baseQueryWithReauth` wrapper that dispatches `logout()` on 401 so
  `ProtectedRoute` bounces to `/login`.

- [x] **3. The refresh token is stored and never used.** `authSlice` persists
  `refreshToken` to localStorage, but no code path ever calls `POST /auth/refresh-token`,
  so the session dies when the access token expires (`JWT_ACCESS_EXPIRES_IN=1d`) and the
  admin is logged out mid-session even though a valid 30-day refresh token is sitting there.
  *Fix:* on 401, attempt a refresh once (single-flight, shared across concurrent queries)
  and replay the original request; only log out if the refresh itself fails.

- [x] **4. Settings saves nothing.** The whole page is local `useState`. `language`,
  `dateFormat` and `notificationSounds` are exactly the fields
  `PATCH /users/me/app-preferences` accepts, but the endpoint is not in the slice and
  there is no Save button — change a setting, reload, and it silently reverts.
  *Fix:* wire `updateAppPreferences`, hydrate the controls from `GET /users/me`, add a
  Save button with success/error feedback.

- [x] **5. Support contact details are unreachable.** The API exposes
  `GET/PATCH /contact/admin/contact` (the phone number and email the mobile app shows on
  its Contact Us screen). The dashboard has no way to read or edit them, so they can only
  be changed with a database write.
  *Fix:* wire both endpoints and add a Support Contact card to Settings.

- [x] **6. Profile shows a stale cached copy of the admin.** It renders whatever was in
  `localStorage.adminUser` at login and never calls `GET /users/me`, so a name or photo
  changed elsewhere never appears. `PATCH /users/me` and `POST /auth/change-password`
  are also unwired, so an admin cannot edit their own name or change their password.
  *Fix:* fetch `/users/me` on mount, add an Edit-profile form and a Change-password form.

- [x] **7. A failed request is indistinguishable from "no data".** Every list treats
  `error` as an empty result, so an API outage renders the same friendly "No pending
  activities." as a genuinely empty table.
  *Fix:* surface a retryable error state on the Dashboard, Users, Activities, Categories
  and Notifications screens.

- [x] **8. `npm run test:all` fails immediately.** `package.json` carries the API's script
  verbatim — `npm run test:smoke && npm run test:phone && …` — none of which exist in the
  dashboard, so the script exits with "Missing script: test:smoke".
  *Fix:* replace it with the checks this project actually has (`tsc -b`, `vite build`, `oxlint`).

- [x] **9. `favicon.ico` 404s on every page load.** `index.html` declares only a PNG icon,
  so the browser's automatic `/favicon.ico` request 404s and pollutes the console on
  every screen — noise that hides real errors.
  *Fix:* point the icon at the existing `favicon.svg` as well.

- [x] **10. "ACTION REQUIRED" shows when nothing is required.** The Pending Approvals tile
  renders the red badge unconditionally, so it shouts for attention when the count is 0.
  *Fix:* render the badge only when `pendingApprovals > 0`.

- [x] **11. Production CORS would block the dashboard.** `main.ts` allows every origin when
  `CORS_ORIGINS` is unset (fine locally) but the deployed dashboard origin must be listed
  or every request fails in the browser.
  *Fix:* documented in `.env.example` with the dashboard origin as the worked example.
  No code change — the API behaviour is correct.

---

## Verified after the fixes

| Check | Result |
|---|---|
| Contract: 35 endpoints vs. `types.ts`, live API | 35/35 clean |
| Playwright: 19 screens and flows against the live API | 19/19 pass |
| Every screen renders live data with no console or network error | pass |
| Expired access token → silently refreshed, request replayed, admin stays put | pass |
| Dead refresh token → returns to `/login` | pass |
| Settings survive a reload (`DD/MM/YYYY` still set) | pass |
| Support contact round-trips | pass |
| Profile name edit persists | pass |
| Change password: wrong current password refused, correct one accepted | pass |
| API down → "Could not load users" with a retry, not an empty table | pass |
| Mock mode (`VITE_USE_MOCKS=true`): 7 screens, zero calls to the API | pass |
| `npm run test:all` (`tsc -b` + `oxlint` + `vite build`) | pass |

The only two entries the Playwright run still prints as problems are the failures the
tests themselves induce on purpose: the 400 from submitting a deliberately wrong current
password, and the aborted request that simulates the API being down. Both are the asserted
behaviour.

`activityCount` on the Categories screen was double-checked against the data rather than
trusted: Badminton reports 4, and the activities collection holds exactly 4 Badminton rows.

### Not defects — checked and dismissed

- **Console 404s on image URLs.** The seeded test activities carry
  `res.cloudinary.com/demo/...` photo URLs, which genuinely do not exist. Test-data noise,
  not a dashboard bug; `/login` now loads with zero 404s.
- **Error responses omit `data`.** `{ success:false, message }` is the API's error envelope
  and what `err.data.message` reads — the full three-key envelope applies to 2xx only.
- **A 429 from `forgot-password`.** The API's 60-second per-identifier OTP cooldown, seen
  only when the verifier runs twice in a row.
- **Notifications broadcast to Everyone with no audience selector.** Deliberate: the Figma
  frame has no audience control. The API's `Interests` targeting is verified working and is
  available whenever a frame calls for it.
