# Software Requirements Specification (SRS)
## Senior Connect / Arooby — Activity Together Platform

| | |
|---|---|
| **Document version** | 1.0 |
| **Date** | 2026-09-01 |
| **Applies to** | `senior-connect-api` (NestJS backend) + `senior-connect-dashboard` (React admin dashboard) |
| **Audience** | QA / manual testers, backend & frontend developers, product owner |
| **Purpose of this edition** | Every role, every feature, every action, written step by step so the whole system can be tested **manually** end to end |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Roles & Permission Matrix](#3-roles--permission-matrix)
4. [Global API Conventions](#4-global-api-conventions)
5. [Test Environment Setup](#5-test-environment-setup)
6. [Complete Endpoint Reference](#6-complete-endpoint-reference)
7. [Role 1 — Guest (Unauthenticated Visitor)](#7-role-1--guest-unauthenticated-visitor)
8. [Role 2 — Member (Mobile App User)](#8-role-2--member-mobile-app-user)
9. [Role 3 — Organizer (Member who owns an activity)](#9-role-3--organizer-member-who-owns-an-activity)
10. [Role 4 — Participant (Member who joined an activity)](#10-role-4--participant-member-who-joined-an-activity)
11. [Role 5 — Admin (API)](#11-role-5--admin-api)
12. [Role 6 — Admin (Dashboard UI)](#12-role-6--admin-dashboard-ui)
13. [Business Rules & Negative Test Cases](#13-business-rules--negative-test-cases)
14. [Data Model](#14-data-model)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Deliberate Departures & Known Gaps](#16-deliberate-departures--known-gaps)
17. [Manual Test Sign-Off Checklists](#17-manual-test-sign-off-checklists)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the complete functional and non-functional behaviour of the Senior Connect (product name **Arooby**) platform, and provides a **step-by-step manual test script for every role and every action** those roles can perform.

### 1.2 Product scope
Arooby lets people — primarily seniors — **discover, create, and join local activities**. It consists of:

- **Mobile App** (client, consumes the REST API) — sign-up, onboarding, discovery, activity creation, joining, favourites, notifications, profile.
- **Admin Dashboard** (React SPA) — moderation of users, activities and categories; broadcast notifications; platform statistics.
- **Backend REST API** (NestJS + MongoDB) — the single source of truth for both clients.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| **Member** | An account with `role = User`. The mobile app user. |
| **Organizer** | A Member, in the context of an activity **they created** (`organizerId` = them). |
| **Participant** | A Member, in the context of an activity **they joined**. |
| **Admin** | An account with `role = Admin`. Signs in only through the dashboard. |
| **OTP** | 6-digit one-time code, 5-minute TTL, delivered by e-mail or SMS. |
| **E.164** | Canonical international phone format, e.g. `+41791234567`. Stored as `phoneE164`. |
| **Envelope** | The `{ success, message, data, meta? }` JSON wrapper every response uses. |
| **Denormalised count** | `activity.joinedCount` — a stored counter, changed only by atomic increments. |

### 1.4 References
- `CLAUDE.md` — engineering conventions and gotchas (authoritative for developers).
- `docs/ER-DIAGRAM.md` — entity relationship diagram.
- `postman/Senior-Connect-API.postman_collection.json` — importable request collection.
- `*.fig` — Figma designs. **Figma labels are the source of truth for every field name.**

---

## 2. System Overview

### 2.1 Architecture

```
+----------------+          +----------------------+
|  Mobile App    |          |  Admin Dashboard     |
|  (client)      |          |  React + Vite +      |
|                |          |  Redux Toolkit/RTKQ  |
+-------+--------+          +----------+-----------+
        |    HTTPS  { success, message, data }     |
        +------------------+----------------------+
                           |
                           v
                +----------------------+
                |  senior-connect-api  |
                |  NestJS 10 + TS      |
                |  prefix: /api/v1     |
                +----------+-----------+
                           |
                           v
      +------------------------------------------------+
      | MongoDB 7 (single-node replica set rs0)          |
      | + Cloudinary (images)                            |
      | + Nodemailer (e-mail OTP)                        |
      | + Twilio (SMS OTP)                               |
      +------------------------------------------------+
```

### 2.2 Backend modules
`auth`, `users`, `categories`, `activities`, `participants`, `favorites`, `notifications`, `dashboard`, `contact`, `uploads`, plus a public `health` controller.

### 2.3 Technology
| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20 |
| API | NestJS 10, TypeScript (strict) |
| Database | MongoDB 7 + Mongoose 8, **replica set required** (transactions) |
| Auth | JWT access + refresh, bcrypt password hashing |
| Validation | `class-validator` DTOs, global `ValidationPipe({ whitelist: true, transform: true })` |
| Images | Cloudinary (`POST /uploads`) |
| E-mail | Nodemailer (SMTP) |
| SMS | Twilio |
| Dashboard | React 19, Vite, Redux Toolkit + RTK Query, Tailwind 4, React Router 7 |

---

## 3. Roles & Permission Matrix

The system has exactly **two stored roles** (`UserRole.User`, `UserRole.Admin`). Six *effective* testing roles are documented because a Member's rights change with context (owner vs. joiner vs. stranger), and the Admin is tested twice — once through the API, once through the dashboard UI.

### 3.1 Role summary

| # | Role | How it is obtained | Signs in via | Primary surface |
|---|---|---|---|---|
| 1 | **Guest** | No token | — | Mobile app pre-login screens |
| 2 | **Member** | Register + verify OTP | `POST /auth/login` (email **or** phone) | Mobile app |
| 3 | **Organizer** | Member who created an activity | same as Member | Mobile app |
| 4 | **Participant** | Member who joined an activity | same as Member | Mobile app |
| 5 | **Admin (API)** | Seeded (`npm run seed`) | `POST /auth/admin/login` (email only) | Postman / curl |
| 6 | **Admin (UI)** | same account | Dashboard login screen | Admin dashboard |

### 3.2 Full permission matrix

Legend: YES = allowed, NO = forbidden, COND = allowed with condition, `—` = not applicable

| Action | Guest | Member | Organizer (own activity) | Participant | Admin |
|---|---|---|---|---|---|
| Health check | YES | YES | YES | YES | YES |
| Read Contact Us info | YES | YES | YES | YES | YES |
| Register account | YES | — | — | — | — |
| Verify OTP / resend OTP | YES | — | — | — | — |
| Login (email or phone) | YES | YES | YES | YES | COND (email only, via admin login) |
| Admin login | NO 403 | NO 403 | NO | NO | YES |
| Forgot / reset password | YES | YES | YES | YES | YES |
| Change password | NO 401 | YES | YES | YES | YES |
| Refresh token | YES (with a valid refresh token) | YES | YES | YES | YES |
| Logout | NO 401 | YES | YES | YES | YES |
| Request / verify phone OTP | YES (number must already exist) | YES (links number) | YES | YES | YES |
| View own profile / completeness | NO 401 | YES | YES | YES | YES |
| Edit profile, location, interests, photo, preferences | NO 401 | YES | YES | YES | YES |
| Block / unblock another user | NO 401 | YES | YES | YES | YES |
| List active categories | NO 401 | YES | YES | YES | YES |
| Propose a new category | NO 401 | YES (created `Pending`) | YES | YES | YES |
| Create activity | NO 401 | YES | YES | YES | YES |
| Discover / featured / summary / suggestions | NO 401 | YES | YES | YES | YES |
| View activity details | NO 401 | YES | YES | YES | YES |
| Update an activity | NO | NO 403 | YES | NO 403 | NO (admin has no edit endpoint) |
| Delete an activity | NO | NO 403 | YES | NO 403 | YES (any activity) |
| Join an activity | NO 401 | YES | NO 400 (own activity) | NO 409 (already joined) | YES |
| Leave an activity | NO | NO 404 | — | YES | YES |
| Remove a participant | NO | NO 403 | YES | NO 403 | NO (no admin endpoint) |
| List participants of an activity | NO 401 | YES | YES | YES | YES |
| Add / remove favourite, list favourites | NO 401 | YES | YES | YES | YES |
| Read own notifications, unread count, mark read | NO 401 | YES | YES | YES | YES |
| Upload image | NO 401 | YES | YES | YES | YES |
| Admin: list / inspect / moderate users | NO | NO 403 | NO | NO | YES |
| Admin: list / inspect / approve / reject / delete activities | NO | NO 403 | NO | NO | YES |
| Admin: create / edit / approve / reject / delete categories | NO | NO 403 | NO | NO | YES |
| Admin: compose broadcast + history | NO | NO 403 | NO | NO | YES |
| Admin: dashboard statistics | NO | NO 403 | NO | NO | YES |
| Admin: edit Contact Us info | NO | NO 403 | NO | NO | YES |

### 3.3 How authorisation is enforced
- **`JwtAuthGuard`** — global. Every route requires `Authorization: Bearer <accessToken>` unless decorated `@Public()`.
  - Missing token gives `401 "Access token is missing"`.
  - Invalid or expired token gives `401 "Invalid or expired access token"`.
  - On a `@Public()` route a token is still **decoded when offered** (so `@OptionalUser()` works) but never rejected.
- **`RolesGuard`** — routes decorated `@Roles(UserRole.Admin)` require `role = Admin`, otherwise `403 "You do not have permission to access this resource"`.
- **Ownership checks** live in the services (organizer-only update, delete, and remove-participant).
- **Account status gate** — `Blocked` and `Suspended` accounts are refused at login with `403 "Your account is blocked"` / `"Your account is suspended"`.
- **Verification gate** — login is refused with `403 "Please verify your email first"` / `"Please verify your phone number first"` when the *identifier being used* is unverified. A verified e-mail does **not** unlock phone login and vice versa. Admin accounts are exempt from this gate.

---

## 4. Global API Conventions

### 4.1 Base URL
```
http://localhost:5000/api/v1
```
Configurable via `PORT` and `API_PREFIX`.

### 4.2 Success envelope
```json
{ "success": true, "message": "Activities retrieved successfully", "data": {} }
```
Paginated lists add `meta`:
```json
{
  "success": true,
  "message": "Activities retrieved successfully",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

### 4.3 Error envelope
```json
{ "success": false, "message": "Only the organizer can update this activity" }
```
Validation failures add the full list:
```json
{
  "success": false,
  "message": "Password must be at least 6 characters.",
  "errors": ["Password must be at least 6 characters."]
}
```

### 4.4 Status codes used
| Code | When |
|---|---|
| `200 OK` | Reads, and every `POST` explicitly marked `@HttpCode(200)` — that is all auth endpoints except register |
| `201 Created` | `POST /auth/register`, `POST /activities`, `POST /categories`, `POST /uploads`, joins, favourites, blocks |
| `400 Bad Request` | Validation failure, or a business rule violation (age limit, wrong status, mismatched passwords) |
| `401 Unauthorized` | Missing or invalid token, bad credentials, dead refresh token |
| `403 Forbidden` | Wrong role, unverified identifier, blocked/suspended account, not the organizer, removed participant |
| `404 Not Found` | Unknown id, or a resource the caller has no relationship with |
| `409 Conflict` | Duplicate account, duplicate join, duplicate favourite, activity full, category name taken |
| `429 Too Many Requests` | OTP rate limit exceeded |

### 4.5 Pagination
Every list accepts `page` (default `1`, minimum `1`) and `limit` (default `10`, minimum `1`, **maximum `100`** — larger values are clamped, not rejected).

### 4.6 Identifiers
All ids are MongoDB `ObjectId` values (24 hexadecimal characters). A malformed id returns `404`, never a 500.

### 4.7 Dual identity (critical for testing)
`email` **and** `phoneE164` are both login identifiers.

| Endpoint | Accepts |
|---|---|
| `register` | e-mail, phone, **or both** (at least one) |
| `login`, `verify-otp`, `resend-otp`, `forgot-password`, `reset-password` | **exactly one** — sending both is a 400 |
| `admin/login` | e-mail only |

Phone may be supplied as the Figma split `phoneCountryCode` + `phoneNumber`, or pre-joined as `phoneE164`. The server normalises to E.164 before anything is stored or looked up, so `"+41" / "079..."` and `"+41" / "79..."` are the same subscriber.

### 4.8 OTP behaviour
- 6 digits, expires in `OTP_EXPIRES_IN_MINUTES` (default **5**).
- Consumed atomically — a code cannot be redeemed twice.
- **In development, when SMTP/Twilio are not configured the OTP is not delivered — it is printed to the API server console** as `[DEV] OTP for <identifier>: 123456`. Keep that terminal visible while testing.

### 4.9 OTP rate limits (defaults)
| Budget | E-mail | SMS |
|---|---|---|
| Cooldown between requests for the same identifier | 60 s | 60 s |
| Per identifier / hour | 5 | 3 |
| Per identifier / day | 15 | 10 |
| Per caller IP / hour | 100 | 15 |
| Per caller IP / day | 300 | 40 |

Exceeding any budget returns `429`. Counting is done on `otp_request_logs`, so letting codes expire does **not** refill the budget.

> **Tester note.** A long manual session from one machine can exhaust the per-IP hourly cap — the SMS cap is only 15/hour. If requests suddenly start returning 429, that is the limiter working, not a bug. For local testing raise only `OTP_EMAIL_MAX_PER_IP_HOUR` and `OTP_SMS_MAX_PER_IP_HOUR`; never the cooldown or the per-identifier budgets.

---

## 5. Test Environment Setup

### 5.1 Prerequisites
- Node.js >= 20, npm
- Docker Desktop (for MongoDB)
- Postman (import `postman/Senior-Connect-API.postman_collection.json`) or `curl`
- A browser for the dashboard

### 5.2 Start the database
```bash
cd senior-connect-api
docker compose up -d       # MongoDB 7 as replica set rs0, container "arooby-db", host port 27018
docker compose ps          # wait until it reports healthy
```
> The replica set is **mandatory** — the join path relies on atomic conditional updates and the option of a transaction. A plain standalone `mongod` will break joins.

### 5.3 Configure and start the API
```bash
cd senior-connect-api
cp .env.example .env       # then edit
npm install
npm run db:sync-indexes    # required once on any pre-existing database
npm run seed               # 13 Figma categories + the admin account
npm run start:dev          # http://localhost:5000/api/v1
```

Minimum `.env` for local manual testing:
```
PORT=5000
API_PREFIX=api/v1
DB_HOST=localhost
DB_PORT=27018
DB_DATABASE=arooby
JWT_ACCESS_SECRET=local-access-secret
JWT_REFRESH_SECRET=local-refresh-secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d
OTP_EXPIRES_IN_MINUTES=5
# SMTP_* and TWILIO_* left blank  ->  OTPs print to the API console
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>   # only needed to test uploads
```

### 5.4 Start the dashboard
```bash
cd senior-connect-dashboard
npm install
npm run dev                # http://localhost:5173
```

> **CRITICAL for dashboard testing.** The dashboard ships with an in-memory mock backend that is **ON by default under `npm run dev`**. To test against the real API you must create `senior-connect-dashboard/.env.local`:
> ```
> VITE_USE_MOCKS=false
> VITE_API_URL=http://localhost:5000/api/v1
> ```
> The rule (in `src/mocks/mockBaseQuery.ts`): mocks are on when `VITE_USE_MOCKS=true`, **or** when running in dev mode and `VITE_USE_MOCKS` is not `false`. Production builds always talk to the real API.
> **How to tell which mode you are in:** open DevTools → Network. With mocks on, no XHR requests leave the page. With mocks off, you see calls to `localhost:5000`.

### 5.5 Seeded credentials
| Role | Credential |
|---|---|
| Admin | `admin@contenthub.io` / `admin123` |

Seeded categories (13): Football, Cycling, Swimming, Basketball, Skiing, Climbing, Tennis, Table Tennis, Badminton, Handball, Golf, Boxing, Rowing.

### 5.6 Optional demo data and automated suites
```bash
npm run seed:demo     # richer demo dataset
npm run test:all      # 8 shell suites: smoke, phone, home, categories, moderation, completeness, targeting, race
```

### 5.7 Test accounts to create before starting
Create these once; the role scripts below refer to them by these aliases.

| Alias | Purpose | Suggested identity |
|---|---|---|
| **ALICE** | Organizer | `alice@test.io` / `password123`, DOB `1955-04-08` |
| **BOB** | Participant | `bob@test.io` / `password123`, DOB `1958-01-20` |
| **CARL** | Second participant / block target | `carl@test.io` / `password123`, DOB `1949-11-02` |
| **DANA** | Phone-only account | `+41 791234567` / `password123` |
| **ADMIN** | Moderation | seeded `admin@contenthub.io` / `admin123` |

---
## 6. Complete Endpoint Reference

All paths are relative to `http://localhost:5000/api/v1`.
**Auth** column: `Public` = no token needed; `User` = any signed-in account; `Admin` = `role = Admin`; `Owner` = must be the organizer.

### 6.1 Health
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness probe |

### 6.2 Auth (`/auth`)
| Method | Path | Auth | Success | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | Public | 201 | Create Account |
| POST | `/auth/verify-otp` | Public | 200 | Redeem the verification code; returns tokens |
| POST | `/auth/resend-otp` | Public | 200 | "Didn't get the code?" |
| POST | `/auth/login` | Public | 200 | Sign in with e-mail **or** phone + password |
| POST | `/auth/admin/login` | Public | 200 | Dashboard sign-in (e-mail only, `rememberMe` extends refresh to 90d) |
| POST | `/auth/phone/request-otp` | Public + optional token | 200 | Send an SMS code to a number |
| POST | `/auth/phone/verify` | Public + optional token | 200 | Redeem it: links the number, or signs the caller in |
| POST | `/auth/forgot-password` | Public | 200 | Send a reset code |
| POST | `/auth/reset-password` | Public | 200 | Redeem the code and set a new password |
| POST | `/auth/change-password` | User | 200 | Change password while signed in |
| POST | `/auth/refresh-token` | Public | 200 | Exchange a refresh token for a new pair |
| POST | `/auth/logout` | User | 200 | Clears the stored refresh token |

### 6.3 Users (`/users`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users/me` | User | Profile screen (stats + interests) |
| GET | `/users/me/completeness` | User | Profile completeness ring (derived, nothing stored) |
| PATCH | `/users/me` | User | Edit Profile Info |
| PATCH | `/users/me/location` | User | Onboarding 1 of 3 — Your location |
| PATCH | `/users/me/interests` | User | Onboarding 2 of 3 — Choose Interests (min 3) |
| PATCH | `/users/me/profile-photo` | User | Onboarding 3 of 3 — Profile Photo |
| PATCH | `/users/me/app-preferences` | User | App Preferences |
| GET | `/users/me/blocked-users` | User | Blocked Users screen |
| POST | `/users/:userId/block` | User | Block a user |
| DELETE | `/users/:userId/block` | User | Unblock a user |
| GET | `/users/admin/users` | Admin | Users table |
| GET | `/users/admin/users/:userId` | Admin | User Details |
| PATCH | `/users/admin/users/:userId/status` | Admin | Change account status |

### 6.4 Categories (`/categories`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/categories` | User | Active categories only (chips, interests picker) |
| POST | `/categories` | User | Propose a category — created `Pending`, usable immediately |
| POST | `/categories/admin/categories` | Admin | Add Category (created `Active`) |
| GET | `/categories/admin/categories` | Admin | Categories table + stats |
| PATCH | `/categories/admin/categories/:id` | Admin | Rename / enable / disable |
| PATCH | `/categories/admin/categories/:id/status` | Admin | Approve (`Active`) or reject (`Disabled`) a proposal |
| DELETE | `/categories/admin/categories/:id` | Admin | Delete (blocked when activities reference it) |

### 6.5 Activities (`/activities`)
> **Route order matters.** Literal routes (`featured`, `summary`, `suggestions`, `my-activities`, `joined-activities`, `admin/...`) are declared before `:id`, so they are never parsed as an ObjectId.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/activities` | User | Create Activity (Draft or Pending) |
| GET | `/activities` | User | Discover: search, filters, map/list, sort |
| GET | `/activities/featured` | User | "Featured this weekend" (max 10) |
| GET | `/activities/summary` | User | Home hero count — "N activities happening near you today" |
| GET | `/activities/suggestions` | User | Search autocomplete (`q`, min 2 chars) |
| GET | `/activities/my-activities` | User | Activities I organise (All / Upcoming / Past) |
| GET | `/activities/joined-activities` | User | Activities I joined (All / Upcoming / Past) |
| GET | `/activities/:id` | User | Activity Details |
| PATCH | `/activities/:id` | Owner | Edit own activity |
| DELETE | `/activities/:id` | Owner | Delete own activity (cascades participants + favourites) |
| GET | `/activities/admin/activities` | Admin | Moderation list |
| GET | `/activities/admin/activities/:id` | Admin | Moderation details |
| PATCH | `/activities/admin/activities/:id/status` | Admin | Approve / Reject |
| DELETE | `/activities/admin/activities/:id` | Admin | Delete any activity |

### 6.6 Participants (`/participants`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/participants/activities/:activityId/join` | User | Join |
| DELETE | `/participants/activities/:activityId/leave` | User | Leave (status becomes `Cancelled`) |
| DELETE | `/participants/activities/:activityId/participants/:userId` | Owner | Eject a participant (status becomes `Removed`) |
| GET | `/participants/activities/:activityId/participants` | User | Participants list (name, country, age) |

### 6.7 Favorites (`/favorites`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/favorites` | User | Favourite Activities list |
| POST | `/favorites/activities/:activityId` | User | Add favourite |
| DELETE | `/favorites/activities/:activityId` | User | Remove favourite |

### 6.8 Notifications (`/notifications`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | User | My notifications (newest broadcast first) |
| GET | `/notifications/unread-count` | User | Bell badge count |
| PATCH | `/notifications/:id/read` | User | Mark as read (`:id` is **my delivery row id**, not the broadcast id) |
| POST | `/notifications/admin/notifications` | Admin | Compose + send a broadcast |
| GET | `/notifications/admin/notifications` | Admin | Notification history |

### 6.9 Dashboard (`/dashboard`) — Admin only, whole controller
| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard/statistics` | totalUsers, totalActivities, totalRegistrations, pendingApprovals |
| GET | `/dashboard/category-distribution` | Activity breakdown per category, with percentages |
| GET | `/dashboard/recent-users` | New members in the **last 24 hours** (`limit`, default 10, max 50) |
| GET | `/dashboard/recent-activities` | Newest activities (`limit`, default 10, max 50) |

### 6.10 Contact (`/contact`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/contact` | Public | Contact Us page (email + phoneNumber) |
| GET | `/contact/admin/contact` | Admin | Full record for the editor |
| PATCH | `/contact/admin/contact` | Admin | Update email and/or phone |

### 6.11 Uploads (`/uploads`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/uploads` | User | Multipart field **`file`**. jpg / png / webp only, max **25 MB**. Stored on Cloudinary; returns the URL to put in `activityPhoto` / `profilePhoto`. |

---

## 7. Role 1 — Guest (Unauthenticated Visitor)

### 7.1 What a Guest can do
A Guest holds no token. Only routes decorated `@Public()` are reachable. Everything else answers `401 "Access token is missing"`.

| # | Feature | Endpoint |
|---|---|---|
| G1 | Check the API is alive | `GET /health` |
| G2 | Read Contact Us details | `GET /contact` |
| G3 | Create an account | `POST /auth/register` |
| G4 | Verify the account with an OTP | `POST /auth/verify-otp` |
| G5 | Ask for the code again | `POST /auth/resend-otp` |
| G6 | Sign in | `POST /auth/login` |
| G7 | Request a phone sign-in code | `POST /auth/phone/request-otp` |
| G8 | Sign in by redeeming a phone code | `POST /auth/phone/verify` |
| G9 | Start a password reset | `POST /auth/forgot-password` |
| G10 | Finish a password reset | `POST /auth/reset-password` |
| G11 | Refresh an expired access token | `POST /auth/refresh-token` |

### 7.2 Manual test script — Guest

#### TC-G-01 — Health check
1. `GET http://localhost:5000/api/v1/health` with no headers.
2. **Expect** `200` and
```json
{ "success": true, "message": "Senior Connect API is healthy",
  "data": { "status": "ok", "timestamp": "2026-09-01T..." } }
```

#### TC-G-02 — Read public contact info
1. `GET /contact` with no token.
2. **Expect** `200` with `data.email` and `data.phoneNumber`. On a fresh database these default to `support@arooby.io` / `+654203540012` (the record is created on first read).

#### TC-G-03 — Register with e-mail (happy path, creates ALICE)
1. `POST /auth/register`
```json
{
  "firstName": "Alice",
  "lastName": "Meyer",
  "email": "alice@test.io",
  "password": "password123",
  "dateOfBirth": "1955-04-08",
  "language": "English (United States)",
  "acceptTerms": true
}
```
2. **Expect** `201`, message `"We've sent a verification code to your email."`, and `data` containing `email`, `phoneE164: null`, `channel: "Email"`, `channels: ["Email"]`, `otpSent: true`.
3. **Check the API console** for `[DEV] OTP for alice@test.io: XXXXXX`. Write the code down.
4. **Check the database (optional):** the account exists with `status: "Pending"`, `isEmailVerified: false`.

#### TC-G-04 — Register with phone only (creates DANA)
1. `POST /auth/register`
```json
{
  "firstName": "Dana",
  "lastName": "Rossi",
  "phoneCountryCode": "+41",
  "phoneNumber": "791234567",
  "password": "password123",
  "acceptTerms": true
}
```
2. **Expect** `201`, message `"We've sent a verification code to your phone."`, `data.channel = "Sms"`, `data.phoneE164 = "+41791234567"`.
3. Console shows `[DEV] OTP for +41791234567: XXXXXX`.

#### TC-G-05 — Register with both identifiers
1. Register a new user supplying `email` **and** `phoneCountryCode` + `phoneNumber`.
2. **Expect** `201` and `data.channels = ["Email", "Sms"]` — **two separate codes** are issued, one per channel, and each must be verified separately.

#### TC-G-06 — Registration validation failures
Run each and confirm `400` with the stated message.

| Body change | Expected message |
|---|---|
| `acceptTerms: false` | `You must accept the Terms & Conditions & Privacy Policy.` |
| `password: "12345"` | `Password must be at least 6 characters.` |
| omit both `email` and phone | `Provide an email address or a phone number` |
| `phoneCountryCode: "+41", phoneNumber: "abc"` | `phoneCountryCode and phoneNumber must form a valid international number` |
| omit `firstName` | `firstName must be a string` |
| `email: "not-an-email"` | `email must be an email` |

#### TC-G-07 — Duplicate registration
1. Complete TC-G-08 first so ALICE is **verified**.
2. Repeat TC-G-03 with the same e-mail.
3. **Expect** `409 "An account with this email already exists"`.
4. **Contrast:** register a *fresh* e-mail, do **not** verify it, then register that same e-mail again with different details. **Expect** `201` — an unverified registration may be re-submitted, the details are refreshed and a new code goes out.

#### TC-G-08 — Verify OTP (e-mail)
1. `POST /auth/verify-otp`
```json
{ "email": "alice@test.io", "otpCode": "<code from console>" }
```
2. **Expect** `200`, message `"Account verified successfully"`, `data.accessToken`, `data.refreshToken`, `data.user`.
3. `data.user.status` is now `"Active"` and `isEmailVerified: true`.
4. **Save the tokens as ALICE_TOKEN / ALICE_REFRESH.**

#### TC-G-09 — OTP negative cases
| Case | Expected |
|---|---|
| Re-send the same body from TC-G-08 again | `400 "Invalid or expired verification code"` (codes are single-use) |
| `otpCode: "000000"` | `400 "Invalid or expired verification code"` |
| `otpCode: "12345"` (5 digits) | `400 "otpCode must be a 6 digit code"` |
| Wait > 5 minutes then verify | `400 "Invalid or expired verification code"` |
| Send `email` **and** `phoneNumber` together | `400 "Provide either email or a phone number, not both"` |

#### TC-G-10 — Resend OTP and the cooldown
1. Register a fresh account, do not verify it.
2. `POST /auth/resend-otp` with `{ "email": "<that email>" }` **immediately**.
3. **Expect** `429` — the 60-second per-identifier cooldown is in force.
4. Wait 60 seconds, repeat. **Expect** `200` and a new code in the console.
5. Repeat until the hourly per-identifier cap (5 for e-mail) is hit. **Expect** `429`.
6. `POST /auth/resend-otp` with an e-mail that has no account. **Expect** `400 "No account found with this email"`.

#### TC-G-11 — Login with e-mail
1. `POST /auth/login`
```json
{ "email": "alice@test.io", "password": "password123" }
```
2. **Expect** `200`, message `"Signed in successfully"`, tokens + profile.

#### TC-G-12 — Login negative cases
| Case | Expected |
|---|---|
| Wrong password | `401 "Invalid email or password"` |
| Unknown e-mail | `401 "Invalid email or password"` (deliberately identical, so the API cannot be used to enumerate accounts) |
| Unverified account | `403 "Please verify your email first"` |
| Account set to `Blocked` by an admin | `403 "Your account is blocked"` |
| Account set to `Suspended` | `403 "Your account is suspended"` |
| Both `email` and phone in one body | `400 "Provide either email or a phone number, not both"` |
| Neither identifier | `400 "Provide either email or a phone number"` |

#### TC-G-13 — Phone sign-in (passwordless), DANA
1. `POST /auth/phone/request-otp` with **no** token:
```json
{ "phoneCountryCode": "+41", "phoneNumber": "791234567" }
```
2. **Expect** `200` `"We've sent a verification code to your phone."`; console prints the code.
3. `POST /auth/phone/verify` with **no** token:
```json
{ "phoneE164": "+41791234567", "otpCode": "<code>" }
```
4. **Expect** `200`, `data.linked: false`, `data.tokens` present, `data.isPhoneVerified: true`. The account moves from `Pending` to `Active`.
5. **Save DANA_TOKEN.**

#### TC-G-14 — Phone OTP negative cases
| Case | Expected |
|---|---|
| `request-otp` for a number no account owns, no token | `400 "No account found with this phone number"` — this is deliberate: the endpoint must never SMS an arbitrary third party |
| Two `request-otp` calls for the same number within 60 s | `429` |
| More than 3 SMS codes to one number in an hour | `429` |
| `verify` with a wrong code | `400 "Invalid or expired verification code"` |
| `phoneNumber: "abc"` | `400 "Provide a valid international phone number..."` |

#### TC-G-15 — Login with phone + password
1. `POST /auth/login` `{ "phoneCountryCode": "+41", "phoneNumber": "791234567", "password": "password123" }`.
2. **Expect** `200`.
3. **Cross-identifier check:** take an account whose e-mail is verified but whose phone is not, and try to log in by phone. **Expect** `403 "Please verify your phone number first"`. Proving one identifier must not unlock the other.
4. **Normalisation check:** log in with `phoneNumber: "0791234567"` (leading zero). **Expect** `200` — the same subscriber.

#### TC-G-16 — Forgot / reset password
1. `POST /auth/forgot-password` `{ "email": "alice@test.io" }`. **Expect** `200`; the console prints a `Reset Password` code.
2. `POST /auth/reset-password`
```json
{ "email": "alice@test.io", "otpCode": "<code>", "newPassword": "newpass123", "confirmPassword": "newpass123" }
```
3. **Expect** `200 "Your password has been changed successfully"`.
4. Log in with the **old** password. **Expect** `401`.
5. Log in with the **new** password. **Expect** `200`.
6. **Session invalidation:** try `POST /auth/refresh-token` with a refresh token issued *before* the reset. **Expect** `401 "Refresh token is no longer valid"` — a password reset kills every existing session.

#### TC-G-17 — Reset password negative cases
| Case | Expected |
|---|---|
| `newPassword` != `confirmPassword` | `400 "newPassword and confirmPassword do not match"` |
| `newPassword: "12345"` | `400 "Password must be at least 6 characters."` |
| Re-use a consumed reset code | `400 "Invalid or expired verification code"` |
| `forgot-password` for an unknown e-mail | `400 "No account found with this email"` |
| Reset the password of a **phone-only** account using its number | `200` — phone-only accounts must remain recoverable |

#### TC-G-18 — Refresh token
1. `POST /auth/refresh-token` `{ "refreshToken": "<ALICE_REFRESH>" }`.
2. **Expect** `200 "Token refreshed successfully"` with a **new** access + refresh pair.
3. Re-send the **old** refresh token. **Expect** `401 "Refresh token is no longer valid"` (only the newest hash is stored).
4. Send garbage. **Expect** `401 "Invalid or expired refresh token"`.

#### TC-G-19 — Every protected route rejects a Guest
Call each of the following with **no** `Authorization` header and confirm `401 "Access token is missing"`:
`GET /users/me`, `GET /categories`, `GET /activities`, `POST /activities`, `GET /favorites`, `GET /notifications`, `POST /uploads`, `GET /dashboard/statistics`, `GET /users/admin/users`.

#### TC-G-20 — Guest cannot use the admin login
1. `POST /auth/admin/login` `{ "email": "alice@test.io", "password": "password123" }` (a Member account).
2. **Expect** `403 "This account does not have admin access"`.

---
## 8. Role 2 — Member (Mobile App User)

A Member is any verified account with `role = User`. Every request in this section carries `Authorization: Bearer <ALICE_TOKEN>` unless stated otherwise.

### 8.1 Complete list of Member actions

| # | Action | Endpoint |
|---|---|---|
| M1 | View my profile | `GET /users/me` |
| M2 | View profile completeness | `GET /users/me/completeness` |
| M3 | Edit profile info | `PATCH /users/me` |
| M4 | Set location (onboarding 1/3) | `PATCH /users/me/location` |
| M5 | Choose interests (onboarding 2/3) | `PATCH /users/me/interests` |
| M6 | Set profile photo (onboarding 3/3) | `PATCH /users/me/profile-photo` |
| M7 | Change app preferences | `PATCH /users/me/app-preferences` |
| M8 | Change password | `POST /auth/change-password` |
| M9 | Link/verify a phone number | `POST /auth/phone/request-otp` + `/auth/phone/verify` (with token) |
| M10 | Log out | `POST /auth/logout` |
| M11 | Upload an image | `POST /uploads` |
| M12 | Browse categories | `GET /categories` |
| M13 | Propose a category | `POST /categories` |
| M14 | Home hero count | `GET /activities/summary` |
| M15 | Featured this weekend | `GET /activities/featured` |
| M16 | Discover with search, filters, sorting, map/list | `GET /activities` |
| M17 | Search autocomplete | `GET /activities/suggestions` |
| M18 | View activity details | `GET /activities/:id` |
| M19 | View an activity's participants | `GET /participants/activities/:id/participants` |
| M20 | Add / remove / list favourites | `/favorites` |
| M21 | Join an activity | `POST /participants/activities/:id/join` |
| M22 | Create an activity | `POST /activities` |
| M23 | Read notifications, unread count, mark read | `/notifications` |
| M24 | Block / unblock / list blocked users | `/users/:userId/block`, `/users/me/blocked-users` |

### 8.2 Manual test script — Profile & onboarding

#### TC-M-01 — View my profile
1. `GET /users/me` with ALICE_TOKEN.
2. **Expect** `200` with:
   - identity: `id`, `firstName`, `lastName`, `email`, `phoneCountryCode`, `phoneNumber`, `phoneE164`, `dateOfBirth`, `language`, `profilePhoto`, `country`, `region`, `city`, `role`, `status`, `memberSince`
   - stats: `activityJoined`, `activityCreated`, `connections`
   - `interests`: array of `{ id, categoryName }`
3. On a brand-new account all three stats are `0` and `interests` is empty.
4. **`connections`** is the number of *distinct other people* who joined any activity ALICE also joined. Verify later, after joins exist.

#### TC-M-02 — Profile completeness ring
1. `GET /users/me/completeness`.
2. **Expect** `200` with `percentage`, `completed`, `total: 4`, and four `steps` in this exact order:

| key | label | Counts as done when |
|---|---|---|
| `name` | Add your name | firstName **and** lastName are non-empty (always true today) |
| `interests` | Choose your interests | **at least one** interest is stored (not 3 — the "min 3" rule belongs to the onboarding form) |
| `location` | Set your location | **any** of country / region / city, **or** both latitude and longitude |
| `profilePhoto` | Add a profile photo | `profilePhoto` is set |

3. On a fresh account: `percentage: 25`, `completed: 1`.
4. After M4, M5 and M6 below: `percentage: 100`, `completed: 4`.

#### TC-M-03 — Edit profile info
1. `PATCH /users/me`
```json
{ "firstName": "Alicia", "lastName": "Meyer", "dateOfBirth": "1955-04-08" }
```
2. **Expect** `200` and the updated profile.
3. **Phone edit rule (important).** `PATCH /users/me` with `{ "phoneCountryCode": "+41", "phoneNumber": "780001122" }`:
   - **Expect** `200`;
   - `phoneE164` is re-derived to `+41780001122`;
   - **`isPhoneVerified` is reset to `false`.**
   - Now try `POST /auth/login` with that new number — **expect** `403 "Please verify your phone number first"`. The account must not keep signing in with a number it never proved.
4. `PATCH /users/me` with a number already **verified** on another account. **Expect** `409 "This phone number is already in use by another account"`.
5. `PATCH /users/me` with `{ "phoneCountryCode": "+41", "phoneNumber": "xx" }`. **Expect** `400 "phoneCountryCode and phoneNumber must form a valid number"`.
6. **Whitelist check:** send `{ "role": "Admin" }`. **Expect** `200` and the role **unchanged** — the global `ValidationPipe({ whitelist: true })` strips unknown properties, so privilege escalation through the profile editor is impossible.

#### TC-M-04 — Set location (onboarding 1 of 3)
1. GPS path: `PATCH /users/me/location` `{ "latitude": 46.2044, "longitude": 6.1432 }`. **Expect** `200`.
2. Manual path: `PATCH /users/me/location` `{ "country": "Switzerland", "region": "Geneva", "city": "Geneva" }`. **Expect** `200`.
3. Both together: **expect** `200`.
4. Out-of-range: `{ "latitude": 120 }`. **Expect** `400` (`latitude must not be greater than 90`).
5. `{ "longitude": -200 }`. **Expect** `400`.
6. After a successful GPS save, `GET /activities?sort=nearby` and `GET /activities/summary` (with no coordinates) should use this saved location.

#### TC-M-05 — Choose interests (onboarding 2 of 3)
1. `GET /categories` and copy three ids.
2. `PATCH /users/me/interests` `{ "categoryIds": ["<id1>", "<id2>", "<id3>"] }`. **Expect** `200`.
3. `GET /users/me` shows those three under `interests`.
4. Two ids only. **Expect** `400 "Select at least 3 interests."`
5. A well-formed but non-existent ObjectId among them. **Expect** `400 "One or more selected interests do not exist"`.
6. A malformed id (`"abc"`). **Expect** `400` from the `@IsObjectId()` validator.
7. Re-send with a different set — the previous interests are **replaced**, not appended. Verify via `GET /users/me`.

#### TC-M-06 — Profile photo (onboarding 3 of 3)
1. `POST /uploads`, multipart, field name **`file`**, a JPG under 25 MB. **Expect** `201` and a Cloudinary URL in `data`.
2. `PATCH /users/me/profile-photo` `{ "profilePhoto": "<that URL>" }`. **Expect** `200`.
3. `GET /users/me` shows the photo; completeness rises.

#### TC-M-07 — Upload negative cases
| Case | Expected |
|---|---|
| No file attached | `400 "No file uploaded. Use form field \"file\"."` |
| Field named something other than `file` | `400` (same message) |
| A PDF or GIF | `400 "Only jpg, png and webp images are allowed"` |
| A file larger than 25 MB | `413` / `400` from the Multer size limit |
| No token | `401` |

#### TC-M-08 — App preferences
1. `PATCH /users/me/app-preferences`
```json
{ "language": "Deutsch", "dateFormat": "DD/MM/YYYY", "notificationSounds": false, "allowNotifications": false }
```
2. **Expect** `200`.
3. **Consequence to verify later:** with `allowNotifications: false` this account is **excluded from every admin broadcast** (see TC-A-19). Set it back to `true` before testing notifications.
4. Defaults on a new account: `language: "English (United States)"`, `dateFormat: "MM/DD/YYYY"`, `notificationSounds: true`, `allowNotifications: true`.

#### TC-M-09 — Change password
1. `POST /auth/change-password`
```json
{ "currentPassword": "password123", "newPassword": "brandnew1", "confirmPassword": "brandnew1" }
```
2. **Expect** `200 "Your password has been changed successfully"`.
3. Wrong `currentPassword`. **Expect** `400 "Current Password is incorrect"`.
4. Mismatched confirm. **Expect** `400 "newPassword and confirmPassword do not match"`.
5. `newPassword` under 6 characters. **Expect** `400`.
6. No token. **Expect** `401`.
7. Log in with the new password. **Expect** `200`. (Note: unlike a *reset*, a change does **not** clear the refresh token — the current session survives.)

#### TC-M-10 — Link a phone number while signed in
1. As ALICE (e-mail account, no phone yet): `POST /auth/phone/request-otp` **with ALICE_TOKEN**, body `{ "phoneCountryCode": "+41", "phoneNumber": "789998877" }`. **Expect** `200`.
2. `POST /auth/phone/verify` **with ALICE_TOKEN**, body `{ "phoneE164": "+41789998877", "otpCode": "<code>" }`.
3. **Expect** `200`, `data.linked: true`, `data.tokens: null` (already signed in — no new session), `data.isPhoneVerified: true`.
4. **Claim-vs-proof rule:** if another account had *claimed* that number but never verified it, the number is released from that account and linked here. Verify the other account's `phoneE164` is now `null`.
5. If another account has that number **verified**, expect `409 "This phone number is already in use by another account"`.

#### TC-M-11 — Logout
1. `POST /auth/logout`. **Expect** `200 "Logged out successfully"`.
2. The **access token still works until it expires** — logout only clears the stored refresh token. This is by design (stateless JWT).
3. `POST /auth/refresh-token` with the refresh token from that session. **Expect** `401 "Refresh token is no longer valid"`.

### 8.3 Manual test script — Categories

#### TC-M-12 — List active categories
1. `GET /categories`. **Expect** `200` with the 13 seeded categories, sorted A→Z by `categoryName`.
2. **Only `Active` categories appear.** A `Pending` or `Disabled` category must not be in this list.
3. No token. **Expect** `401` (this route is *not* public).

#### TC-M-13 — Propose a new category
1. `POST /categories` `{ "categoryName": "Pétanque" }`.
2. **Expect** `201`, message `"Category submitted for review. You can use it right away."`, and `data.status = "Pending"`.
3. `GET /categories` — **"Pétanque" is absent** (public chips only show `Active`).
4. Propose the same name again. **Expect** `200` (or 201) with message `"Category already exists"` and the existing record — matching is case-insensitive, so `"pétanque"` returns the same row.
5. `categoryName: "A"`. **Expect** `400 "categoryName must be at least 2 characters"`.
6. A name over 100 characters. **Expect** `400`.
7. **Non-blocking rule:** create an activity using this Pending category (TC-O-02). The activity publishes normally and `GET /activities/:id` renders `category.categoryName = "Pétanque"` even while the category is Pending.

### 8.4 Manual test script — Discovery

> Prerequisite: an admin has approved at least 3–5 activities (see Section 11), some today, some this weekend, some with coordinates.

#### TC-M-14 — Home hero summary
1. `GET /activities/summary`. **Expect** `200` with `{ date: "<today ISO>", count: N, radiusKm: <default or null> }`.
2. With saved coordinates on the profile, `radiusKm` is the default nearby radius and the count is limited to that circle.
3. With **no** coordinates on the profile and none in the query, `radiusKm` is `null` and the count is national — so the banner can word itself honestly.
4. `GET /activities/summary?latitude=46.2044&longitude=6.1432&maxDistance=5`. **Expect** the count for a 5 km circle.
5. `?maxDistance=-1`. **Expect** `400` (never a 500 — the value reaches a Mongo geo operator).
6. `?latitude=200`. **Expect** `400`.
7. Only `Approved` activities **dated today** are counted.

#### TC-M-15 — Featured this weekend
1. `GET /activities/featured`. **Expect** `200` with at most **10** cards, sorted by `activityDate` ascending.
2. The window is the coming Saturday–Sunday (on a Sunday, from today to that Sunday).
3. Only `Approved` activities appear.
4. Distances are measured from the caller's **saved** profile location; with none saved, `distanceKm` is `null`.

#### TC-M-16 — Discover: default list
1. `GET /activities`. **Expect** `200` + `meta`.
2. Only `Approved` activities dated **today or later**.
3. Default order: soonest first (`activityDate`, then `activityTime`).
4. Each card contains: `id`, `activityName`, `activityPhoto`, `categoryName`, `activityDate`, `activityTime`, `activityLocation`, `latitude`, `longitude`, `participants` (`"3/10"`), `joinedCount`, `maximumNumberOfParticipants`, `distanceKm`, `status`, `organizer { id, firstName, lastName, profilePhoto }`.

#### TC-M-17 — Discover: search
1. `GET /activities?search=swim`. **Expect** case-insensitive substring matches across `activityName`, `activityLocation` **and** `descriptions`.
2. `?search=` with regex metacharacters, e.g. `?search=.*`. **Expect** it is treated as literal text (the input is escaped), returning few or no rows — **not** every activity.

#### TC-M-18 — Discover: Apply Filter sheet
Test each filter separately, then combined.

| Query | Expected |
|---|---|
| `?categoryId=<id>` | Only activities in that category |
| `?categoryId=<malformed>` | `200` with an empty list and `total: 0` (never a 500) |
| `?activityDate=2026-09-15` | Only that date |
| `?minAge=60` | Only activities whose `maxAge >= 60` |
| `?maxAge=70` | Only activities whose `minAge <= 70` |
| `?minAge=60&maxAge=70` | The overlapping band |
| `?latitude=46.2&longitude=6.14&maxDistance=10` | Only activities within 10 km |
| `?maxDistance=10` **without** coordinates | The distance filter is ignored (no origin to measure from) |
| `?maxDistance=-5` | `400` |
| `?view=map` | **Unpaginated** — every match is returned so the map can plot them all |
| `?view=list` | Paginated as normal |
| `?page=2&limit=5` | Second page of 5; `meta.totalPages` consistent |
| `?limit=5000` | Clamped to 100 |

#### TC-M-19 — Discover: the three Home tab feeds
| Query | Expected |
|---|---|
| `?sort=recent` | Newest created first |
| `?sort=popular` | Highest `joinedCount` first, ties broken by soonest date |
| `?sort=nearby&latitude=46.2&longitude=6.14` | Nearest first |
| `?sort=nearby` **without** coordinates | `400 "sort=nearby requires latitude and longitude"` |
| `?sort=nearby&latitude=46.2&longitude=6.14&maxDistance=5` | Nearest first, capped at 5 km, and `meta.total` matches the number of rows for that same radius |

> The last row is the regression guard for a real bug class: the count query and the find query express the same radius with different Mongo operators. If `meta.total` disagrees with the rows, report it.

#### TC-M-20 — Search autocomplete
1. `GET /activities/suggestions?q=swi`. **Expect** `200` and rows for "Swimming" — a **partial** word must match. (This deliberately does not use a text index, which would only match whole words.)
2. Each row is `{ id, activityName, categoryName }`.
3. `?q=s` (1 char). **Expect** `400 "q must be at least 2 characters"`.
4. `?q=swi&limit=50`. **Expect** the result is clamped (max 20).
5. Only `Approved`, upcoming activities are suggested, soonest first.

#### TC-M-21 — Activity details
1. `GET /activities/:id` for an approved activity.
2. **Expect** `200` with the full detail object: `activityName`, `activityPhoto`, `category { id, categoryName }`, `activityDate`, `activityTime`, `activityLocation`, `latitude`, `longitude`, `distanceKm`, `participants` (`"3/10"`), `joinedCount`, `maximumNumberOfParticipants`, `participantAvatars` (first 5), `descriptions`, `difficulty`, `activityEquipment`, `activityDuration`, `organizer { id, firstName, lastName, email, profilePhoto }`, `minAge`, `maxAge`, `ageLimit` (`"55 Years to 80 Years"`), `price`, `status`, `rejectionReason`, `isJoined`, `isFavorite`, `createdAt`.
3. `isJoined` / `isFavorite` are computed **for the calling user**. Sign in as a different Member and confirm they flip.
4. Unknown id. **Expect** `404 "Activity not found"`.
5. Malformed id (`/activities/abc`). **Expect** `404`, never 500.
6. **Any status is viewable by id** — a `Pending` or `Draft` activity returns 200 if you know its id. Only the *lists* filter by status.

#### TC-M-22 — Participants list
1. `GET /participants/activities/:activityId/participants`. **Expect** `200` + `meta`.
2. Each row: `id`, `userId`, `firstName`, `lastName`, `profilePhoto`, `country`, `age` (derived from `dateOfBirth`, `null` when unknown), `joinedAt`.
3. Only `Joined` rows appear — someone who left (`Cancelled`) or was ejected (`Removed`) must not be listed.
4. Ordered by `joinedAt` ascending.
5. Unknown activity id. **Expect** `404`.

### 8.5 Manual test script — Favourites

#### TC-M-23 — Add, list, remove a favourite
1. `POST /favorites/activities/:activityId`. **Expect** `201`.
2. `GET /favorites`. **Expect** `200` + `meta`, the activity present.
3. `GET /activities/:id` now shows `isFavorite: true`.
4. Add the same one again. **Expect** `409 "Activity is already in favorites"`.
5. `DELETE /favorites/activities/:activityId`. **Expect** `200`.
6. Delete again. **Expect** `404 "Activity is not in favorites"`.
7. Favourite a non-existent activity id. **Expect** `404 "Activity not found"`.
8. **Cascade check:** favourite an activity, then have its organizer delete it. `GET /favorites` no longer lists it — deleting an activity also deletes its favourites and participants.

### 8.6 Manual test script — Notifications (receiving)

#### TC-M-24 — Receive a broadcast
1. Ensure ALICE has `allowNotifications: true` and `status: Active`.
2. Have the admin send a broadcast to `Everyone` (TC-A-17).
3. As ALICE: `GET /notifications`. **Expect** `200`, the broadcast present, sorted by `sentDate` descending, with `isRead: false`, `readAt: null`.
4. `GET /notifications/unread-count`. **Expect** the count to include it.
5. `PATCH /notifications/:id/read` — **`:id` is the `id` from the `GET /notifications` row (your own delivery row), not the broadcast id from the admin history.** **Expect** `200`.
6. `GET /notifications/unread-count` decreases; the row now shows `isRead: true` with a `readAt` timestamp.
7. Mark it read again. **Expect** `200` (idempotent) and the count is unchanged.
8. `PATCH /notifications/<another user's row id>/read`. **Expect** `404 "Notification not found"` — you can only mark your own.
9. Malformed id. **Expect** `404`.

#### TC-M-25 — Interest-targeted broadcast
1. Set ALICE's interests to include **Swimming**, and BOB's to exclude it.
2. Admin sends a broadcast with `audience: "Interests"`, `audienceCategoryIds: ["<Swimming id>"]`.
3. ALICE sees it; **BOB does not**.

### 8.7 Manual test script — Blocking

#### TC-M-26 — Block a user
1. As ALICE: `POST /users/<CARL id>/block`. **Expect** `201`.
2. `GET /users/me/blocked-users`. **Expect** CARL listed.
3. Block CARL again. **Expect** `409 "User is already blocked"`.
4. Block yourself. **Expect** `400 "You cannot block yourself"`.
5. Block an unknown user id. **Expect** `404 "User not found"`.

#### TC-M-27 — What a block actually hides (bidirectional)
1. CARL creates an activity; the admin approves it.
2. ALICE blocks CARL.
3. As **ALICE**: `GET /activities`, `GET /activities/featured`, `GET /activities/suggestions`, `GET /activities/summary` — **CARL's activity is absent from all four.**
4. As **CARL** (who did *not* block anyone): the same four calls — **ALICE's activities are also absent.** The block is bidirectional and account-wide.
5. **But** `GET /activities/<CARL's activity id>` by direct id still returns 200. The filter applies to feeds, not to a direct lookup.
6. `DELETE /users/<CARL id>/block`. **Expect** `200`. Both directions become visible again.
7. Unblock someone who was never blocked. **Expect** `404 "User is not blocked"`.

---

## 9. Role 3 — Organizer (Member who owns an activity)

An Organizer is a Member acting on an activity where `organizerId` equals their own id. There is no separate account type — the rights come from ownership.

### 9.1 Complete list of Organizer actions

| # | Action | Endpoint |
|---|---|---|
| O1 | Create an activity (Draft or submit for approval) | `POST /activities` |
| O2 | Create an activity with a brand-new category inline | `POST /activities` with `categoryName` |
| O3 | List my activities (All / Upcoming / Past) | `GET /activities/my-activities` |
| O4 | Edit my activity | `PATCH /activities/:id` |
| O5 | Submit a Draft for approval | `PATCH /activities/:id` with `submit: true` |
| O6 | Delete my activity | `DELETE /activities/:id` |
| O7 | See who joined | `GET /participants/activities/:id/participants` |
| O8 | Eject a participant | `DELETE /participants/activities/:id/participants/:userId` |

### 9.2 Activity lifecycle

```
                       saveAsDraft: true
  POST /activities  ───────────────────────►  Draft
        │                                       │
        │ saveAsDraft omitted/false             │ PATCH { submit: true }
        ▼                                       ▼
     Pending  ◄──────────────────────────────────
        │
        ├── admin PATCH status=Approved ──►  Approved ──┐
        │                                               │
        └── admin PATCH status=Rejected ──►  Rejected   │
                                                        │
        organizer PATCH any field on an Approved activity
                       │
                       └──────────────────►  Pending (re-moderation)
```

Rules:
- Only `Approved` activities appear in Discover / Featured / Summary / Suggestions, and only `Approved` activities can be joined.
- Editing an **Approved** activity sends it **back to `Pending`** — every change is re-moderated.
- `submit: true` promotes a `Draft` to `Pending`. It has no effect on any other status.
- `Cancelled` and `Completed` exist in the enum but are not produced by any current endpoint.

### 9.3 Manual test script — Organizer

#### TC-O-01 — Create an activity (submit for approval)
1. As ALICE, `POST /activities`:
```json
{
  "activityName": "Morning Swim at the Lake",
  "categoryId": "<Swimming id>",
  "descriptions": "A gentle 45-minute swim followed by coffee.",
  "maximumNumberOfParticipants": 10,
  "activityPhoto": "<uploaded URL or omit>",
  "activityDate": "2026-09-20",
  "activityTime": "09:30",
  "activityDuration": "1 Hour",
  "activityEquipment": "Towel, swimsuit",
  "activityLocation": "Bains des Pâquis, Geneva",
  "latitude": 46.2100,
  "longitude": 6.1520,
  "minAge": 55,
  "maxAge": 85,
  "price": 5,
  "difficulty": "Beginner"
}
```
2. **Expect** `201`, message `"Activity submitted for approval"`, `data.status = "Pending"`, `data.joinedCount = 0`, `data.participants = "0/10"`.
3. **Save the id as ACT_1.**
4. `GET /activities` (Discover) — **ACT_1 is absent** (not approved yet).
5. `GET /activities/my-activities` — **ACT_1 is present** with status `Pending`.

#### TC-O-02 — Create with an inline new category
1. `POST /activities` with `categoryName: "Pétanque"` **instead of** `categoryId`, plus the other required fields.
2. **Expect** `201`. A category named Pétanque is created with status `Pending` and `proposedBy` = ALICE, and the activity uses it immediately.
3. `GET /activities/:id` shows `category.categoryName = "Pétanque"` even though the category is not yet approved.
4. Repeat with the same `categoryName` — the **existing** category is reused (case-insensitive match), not duplicated.

#### TC-O-03 — Save as Draft, then submit
1. `POST /activities` with the same body plus `"saveAsDraft": true`.
2. **Expect** `201`, message `"Activity saved as draft"`, `status: "Draft"`. Save as ACT_DRAFT.
3. `GET /activities/my-activities?tab=All` — present, status `Draft`.
4. `GET /activities` — absent.
5. Try to join it as BOB. **Expect** `400 "This activity is not open for joining"`.
6. `PATCH /activities/ACT_DRAFT` `{ "submit": true }`. **Expect** `200` and `status: "Pending"`.

#### TC-O-04 — Create-activity validation failures
| Body change | Expected |
|---|---|
| Neither `categoryId` nor `categoryName` | `400` (both conditional validators fire) |
| `categoryId` = a valid-looking but unknown ObjectId | `404 "Category not found"` |
| `categoryId: "abc"` | `400` from `@IsObjectId()` |
| `maximumNumberOfParticipants: 0` | `400` (min 1) |
| `maximumNumberOfParticipants: 5000` | `400` (max 1000) |
| `activityTime: "9:30 AM"` | `400` — must be 24-hour `HH:mm` |
| `activityDate: "20-09-2026"` | `400` — must be an ISO date string |
| `minAge: -5` | `400` (min 0) |
| `maxAge: 200` | `400` (max 120) |
| `price: -1` | `400` (min 0) |
| `difficulty: "Expert"` | `400` — allowed values are `Beginner`, `Intermediate`, `Advanced` |
| `latitude: 95` | `400` |
| `activityName` over 150 characters | `400` |
| Omit `descriptions` | `400` |

Defaults worth confirming: `difficulty` omitted becomes `Beginner`; `activityPhoto`, `activityEquipment` and `price` omitted become `null`.

#### TC-O-05 — My Activities tabs
1. Create three activities dated: yesterday, today, next month.
2. `GET /activities/my-activities?tab=All` — all three.
3. `?tab=Upcoming` — today and next month (`activityDate >= today`).
4. `?tab=Past` — yesterday only.
5. Omit `tab` — behaves like `All`.
6. `?tab=Nonsense` — `400` (enum).
7. Ordered by `activityDate` descending; paginated with `meta`.
8. **All statuses appear here**, including `Draft`, `Pending` and `Rejected`. This is the organizer's own workspace.

#### TC-O-06 — Edit my activity
1. `PATCH /activities/ACT_1` `{ "activityName": "Morning Swim + Coffee", "maximumNumberOfParticipants": 12 }`.
2. **Expect** `200 "Activity updated successfully"` with the new values.
3. **Re-moderation rule:** get ACT_1 approved by the admin first, then `PATCH` any field. **Expect** `200` and `status` back to `"Pending"`. Confirm it disappears from Discover until re-approved.
4. Editing a `Pending` activity leaves it `Pending`. Editing a `Rejected` activity leaves it `Rejected` (only `submit: true` on a `Draft` promotes).
5. `PATCH` with coordinates: `{ "latitude": 46.5, "longitude": 6.6 }`. **Expect** `200`, and the geo index picks up the new point (verify by a `sort=nearby` query).
6. `PATCH` with an empty body `{}`. **Expect** `200`, nothing changed, status unchanged.

#### TC-O-07 — Only the organizer may edit
1. As **BOB**, `PATCH /activities/ACT_1` `{ "activityName": "Hijacked" }`.
2. **Expect** `403 "Only the organizer can update this activity"`.
3. As **ADMIN**, the same call. **Expect** `403` as well — there is no admin edit endpoint; admins approve, reject or delete.

#### TC-O-08 — Delete my activity (with cascade)
1. Set up: BOB joins ACT_1, CARL favourites it.
2. As ALICE: `DELETE /activities/ACT_1`. **Expect** `200 "Activity deleted successfully"`.
3. `GET /activities/ACT_1`. **Expect** `404`.
4. As BOB: `GET /activities/joined-activities` — ACT_1 is gone.
5. As CARL: `GET /favorites` — ACT_1 is gone.
6. **Both dependents must be removed** — Mongo has no cascading delete, so this is explicit application logic and a genuine regression risk.
7. As BOB, `DELETE /activities/<ALICE's other activity>`. **Expect** `403 "Only the organizer can delete this activity"`.

#### TC-O-09 — Eject a participant
1. BOB joins ACT_1. Note `participants` is now `"1/10"`.
2. As ALICE: `DELETE /participants/activities/ACT_1/participants/<BOB id>`.
3. **Expect** `200 "Participant removed"` and `data.participants = "0/10"` — the seat is released.
4. `GET /participants/activities/ACT_1/participants` — BOB is gone.
5. **As BOB, try to re-join.** **Expect** `403 "The organizer removed you from this activity"`. A removal must stick — this is what distinguishes `Removed` from `Cancelled`.
6. Remove BOB again. **Expect** `404 "This user is not a participant"` — and confirm `joinedCount` did **not** drop below zero.
7. As **BOB**, try to remove CARL from ALICE's activity. **Expect** `403 "Only the organizer can remove a participant"`.
8. As ALICE, try to remove **yourself**. **Expect** `400 "You cannot remove yourself from your own activity"`.
9. **Removal is not a block.** After ejecting BOB, `GET /users/me/blocked-users` as ALICE must be **empty**, and ALICE's other activities must still be visible to BOB. Removing from one event must never silently create an account-wide, bidirectional block.

---

## 10. Role 4 — Participant (Member who joined an activity)

### 10.1 Complete list of Participant actions

| # | Action | Endpoint |
|---|---|---|
| P1 | Join an activity | `POST /participants/activities/:activityId/join` |
| P2 | List activities I joined (All / Upcoming / Past) | `GET /activities/joined-activities` |
| P3 | Leave an activity | `DELETE /participants/activities/:activityId/leave` |
| P4 | See fellow participants | `GET /participants/activities/:activityId/participants` |
| P5 | See my `isJoined` state on the details screen | `GET /activities/:id` |

### 10.2 Participant status model

| Status | Set by | May re-join? |
|---|---|---|
| `Joined` | The user pressing Join | — |
| `Cancelled` | The user leaving of their own accord | **Yes** |
| `Removed` | The organizer ejecting them | **No** — 403 |

### 10.3 Manual test script — Participant

#### TC-P-01 — Join an activity (happy path)
1. Prerequisite: ACT_1 is `Approved`, has free seats, and BOB's age falls inside `minAge`–`maxAge`.
2. As BOB: `POST /participants/activities/ACT_1/join`.
3. **Expect** `201`, message `"You're going!"`, `data.participants = "1/10"`.
4. `GET /activities/ACT_1` as BOB — `isJoined: true`, `joinedCount: 1`, BOB's avatar in `participantAvatars`.
5. `GET /activities/joined-activities` — ACT_1 present.
6. `GET /participants/activities/ACT_1/participants` — BOB listed with his country and age.

#### TC-P-02 — Join negative cases
| Case | Expected |
|---|---|
| Join again | `409 "You have already joined this activity"` |
| Join your **own** activity | `400 "You are the organizer of this activity"` |
| Join a `Draft` / `Pending` / `Rejected` activity | `400 "This activity is not open for joining"` |
| Join when `joinedCount == maximumNumberOfParticipants` | `409 "This activity is full"` |
| Join after being ejected | `403 "The organizer removed you from this activity"` |
| Join with an age outside the range | `400 "Age Limit: 55 Years to 85 Years"` |
| Join an unknown activity id | `404 "Activity not found"` |
| Join with a malformed id | `404`, never 500 |
| Join with no token | `401` |

> **Age rule detail:** the check only runs when the user has a `dateOfBirth`. An account with no date of birth is **not** blocked by the age range.

#### TC-P-03 — Capacity is exact under concurrency
1. Create an activity with `maximumNumberOfParticipants: 1`, approved.
2. Fire two joins from two different accounts **simultaneously** (two Postman tabs, or `npm run test:race`).
3. **Expect** exactly one `201` and one `409 "This activity is full"`.
4. `GET /activities/:id` — `joinedCount` is exactly `1`, never `2`.
5. Now fire two joins from the **same** account simultaneously. **Expect** one `201` and one `409 "You have already joined this activity"`, with `joinedCount` still `1` — the losing request must hand its seat back, not keep it.

> This is the single highest-risk area of the system. `joinedCount` is denormalised, and a read-then-write would oversubscribe. `npm run test:race` automates both cases.

#### TC-P-04 — Joined Activities tabs
1. Join activities dated in the past and the future.
2. `?tab=All`, `?tab=Upcoming`, `?tab=Past` behave exactly as in TC-O-05, but over joined rather than organised activities.
3. Only rows with status `Joined` are included — after leaving, an activity disappears from this list.
4. Ordered by `activityDate` descending, paginated.

#### TC-P-05 — Leave an activity
1. As BOB (joined ACT_1): `DELETE /participants/activities/ACT_1/leave`.
2. **Expect** `200 "You left the activity"`.
3. `GET /activities/ACT_1` — `joinedCount` decremented by exactly 1, `isJoined: false`.
4. `GET /activities/joined-activities` — ACT_1 absent.
5. `GET /participants/.../participants` — BOB absent.
6. Leave again. **Expect** `404 "You have not joined this activity"` and **`joinedCount` unchanged** — a repeated call must not decrement twice.
7. **Re-join after leaving.** **Expect** `201` — leaving is reversible, unlike being removed.
8. Leave an activity you never joined. **Expect** `404`.

#### TC-P-06 — Connections counter
1. ALICE and BOB both join CARL's approved activity.
2. `GET /users/me` as ALICE — `connections` includes BOB (distinct people met through shared activities), and does **not** count ALICE herself.
3. Both join a second shared activity. `connections` stays the same — it counts distinct people, not memberships.

---
## 11. Role 5 — Admin (API)

The Admin account is created by `npm run seed`. It has `role = Admin`, `status = Active`, `isEmailVerified = true`. Every request in this section carries `Authorization: Bearer <ADMIN_TOKEN>`.

### 11.1 Complete list of Admin actions

| # | Action | Endpoint |
|---|---|---|
| A1 | Admin login | `POST /auth/admin/login` |
| A2 | Dashboard statistics | `GET /dashboard/statistics` |
| A3 | Category distribution | `GET /dashboard/category-distribution` |
| A4 | Recent users (last 24 h) | `GET /dashboard/recent-users` |
| A5 | Recent activities | `GET /dashboard/recent-activities` |
| A6 | Users table (search / filter / tabs) | `GET /users/admin/users` |
| A7 | User details | `GET /users/admin/users/:userId` |
| A8 | Change a user's status | `PATCH /users/admin/users/:userId/status` |
| A9 | Activities moderation list | `GET /activities/admin/activities` |
| A10 | Activity moderation details | `GET /activities/admin/activities/:id` |
| A11 | Approve an activity | `PATCH .../status` `{ "status": "Approved" }` |
| A12 | Reject an activity (with reason) | `PATCH .../status` `{ "status": "Rejected", "rejectionReason": "..." }` |
| A13 | Delete any activity | `DELETE /activities/admin/activities/:id` |
| A14 | Categories table + stats | `GET /categories/admin/categories` |
| A15 | Add a category | `POST /categories/admin/categories` |
| A16 | Rename / enable / disable a category | `PATCH /categories/admin/categories/:id` |
| A17 | Approve or reject a proposed category | `PATCH /categories/admin/categories/:id/status` |
| A18 | Delete a category | `DELETE /categories/admin/categories/:id` |
| A19 | Compose and send a broadcast | `POST /notifications/admin/notifications` |
| A20 | Notification history | `GET /notifications/admin/notifications` |
| A21 | Read / edit Contact Us info | `GET`/`PATCH /contact/admin/contact` |
| A22 | Everything a Member can do on their own account | `/users/me`, `/uploads`, `/auth/change-password`, ... |

### 11.2 Manual test script — Admin API

#### TC-A-01 — Admin login
1. `POST /auth/admin/login` `{ "email": "admin@contenthub.io", "password": "admin123" }`.
2. **Expect** `200 "Admin signed in successfully"`, tokens, `data.user.role = "Admin"`.
3. **Save ADMIN_TOKEN.**
4. With `"rememberMe": true` — the refresh token is issued with a **90-day** expiry instead of the default 30 days.

#### TC-A-02 — Admin login negative cases
| Case | Expected |
|---|---|
| A Member's e-mail + correct password | `403 "This account does not have admin access"` |
| Wrong password | `401 "Invalid email or password"` |
| Unknown e-mail | `401 "Invalid email or password"` |
| Phone instead of e-mail | `400` — admin login is e-mail only, by design; admin access must not be reachable through the SMS flow |

#### TC-A-03 — Role guard on every admin route
Sign in as ALICE (a Member) and call each of these with **ALICE_TOKEN**. Every one must return `403 "You do not have permission to access this resource"`:

`GET /dashboard/statistics`, `GET /dashboard/category-distribution`, `GET /dashboard/recent-users`, `GET /dashboard/recent-activities`, `GET /users/admin/users`, `GET /users/admin/users/:id`, `PATCH /users/admin/users/:id/status`, `GET /activities/admin/activities`, `GET /activities/admin/activities/:id`, `PATCH /activities/admin/activities/:id/status`, `DELETE /activities/admin/activities/:id`, `POST /categories/admin/categories`, `GET /categories/admin/categories`, `PATCH /categories/admin/categories/:id`, `PATCH /categories/admin/categories/:id/status`, `DELETE /categories/admin/categories/:id`, `POST /notifications/admin/notifications`, `GET /notifications/admin/notifications`, `GET /contact/admin/contact`, `PATCH /contact/admin/contact`.

> This is 20 checks. It is the single most important security regression test in the suite — run it after any change to guards or decorators.

#### TC-A-04 — Dashboard statistics
1. `GET /dashboard/statistics`. **Expect** `200` with:

| Field | Meaning |
|---|---|
| `totalUsers` | Accounts with `role = User` — **admins are excluded** |
| `totalActivities` | **All** activities, every status included |
| `totalRegistrations` | Participant rows with status `Joined` |
| `pendingApprovals` | Activities with status `Pending` |

2. Cross-check each number by hand against the corresponding list endpoint.
3. Approve a pending activity, re-read: `pendingApprovals` drops by 1, `totalActivities` unchanged.
4. Have a member join something: `totalRegistrations` rises by 1. Have them leave: it falls back.

#### TC-A-05 — Category distribution
1. `GET /dashboard/category-distribution`. **Expect** `200`, an array of `{ categoryName, activityCount, percentage }`, sorted by count descending.
2. Percentages are rounded and computed over **all** activities that have a category.
3. Categories with zero activities do not appear.
4. On an empty database, `data` is `[]` (no division-by-zero, no 500).

#### TC-A-06 — Recent users
1. `GET /dashboard/recent-users`. **Expect** `200`, up to 10 rows: `{ id, firstName, lastName, email, profilePhoto, dateJoined, status }`.
2. **Only members created in the last 24 hours**, newest first. An older account must not appear.
3. `?limit=4` returns 4. `?limit=200` is clamped to **50**.
4. Admin accounts are excluded.

#### TC-A-07 — Recent activities
1. `GET /dashboard/recent-activities`. **Expect** `200`, up to 10 rows: `{ id, activityName, activityPhoto, activityLocation, categoryName, activityDate, status }`, newest **created** first.
2. **No 24-hour window here** — unlike recent users, this is simply the newest activities.
3. All statuses appear, including `Draft` and `Rejected`.
4. `?limit=200` is clamped to 50.

#### TC-A-08 — Users table
1. `GET /users/admin/users`. **Expect** `200` + `meta`. Rows: `{ id, firstName, lastName, profilePhoto, email, country, activities, status, dateJoined }`, newest first.
2. **`activities` = activities organised + activities joined**, combined into one figure.
3. Admin accounts are never listed.
4. Filters:

| Query | Expected |
|---|---|
| `?search=ali` | Case-insensitive match on firstName, lastName, email **or** country |
| `?search=.*` | Treated literally (regex-escaped), not as a wildcard |
| `?tab=All Users` | No status filter |
| `?tab=Active Users` | Only `Active` |
| `?tab=Blocked Users` | Only `Blocked` |
| `?status=Suspended` | Only `Suspended`. **`status` wins over `tab` when both are sent** |
| `?status=Nonsense` | `400` (enum) |
| `?tab=Nonsense` | `400` (only the three listed values are allowed) |
| `?page=2&limit=5` | Paginated |

#### TC-A-09 — User details
1. `GET /users/admin/users/<ALICE id>`. **Expect** `200` with the full profile plus:
   - `activitiesJoined`, `activitiesCreated`, `connections`, `interests`
   - `createdActivities` — up to **10**, newest activity date first, each `{ id, activityName, categoryName, activityDate, status }`
   - `joinedActivities` — up to **10**, most recently joined first
2. Unknown user id. **Expect** `404 "User not found"`.
3. Malformed id. **Expect** `404`, never 500.

#### TC-A-10 — Change a user's status
1. `PATCH /users/admin/users/<CARL id>/status` `{ "status": "Blocked" }`.
2. **Expect** `200 "User status updated to Blocked"`.
3. As CARL, try to log in. **Expect** `403 "Your account is blocked"`.
4. **Existing token check:** CARL's *previously issued* access token still works until it expires — status is checked at login, not on every request. Note this as expected behaviour, not a bug.
5. Set `"Suspended"` → login gives `403 "Your account is suspended"`.
6. Set `"Inactive"` → **login still succeeds** (only `Blocked` and `Suspended` are refused). Confirm and record this.
7. Set back to `"Active"` → login succeeds again.
8. `{ "status": "Deleted" }`. **Expect** `400` (enum: `Pending`, `Active`, `Inactive`, `Suspended`, `Blocked`).
9. **Broadcast consequence:** a non-`Active` user is excluded from admin broadcasts. Verify with TC-A-19.

#### TC-A-11 — Activities moderation list
1. `GET /activities/admin/activities`. **Expect** `200` + `meta`, **all statuses**, newest created first.
2. Filters:

| Query | Expected |
|---|---|
| `?status=Pending` | The approval queue |
| `?status=Approved` / `?status=Rejected` / `?status=Draft` | Filtered accordingly |
| `?categoryId=<id>` | That category only |
| `?categoryId=<malformed>` | `200`, empty list, `total: 0` |
| `?activityDate=2026-09-20` | Exact date match |
| `?search=swim` | Case-insensitive match on **`activityName` only** (narrower than the member-facing Discover search) |
| `?page=2&limit=5` | Paginated |

3. Unlike Discover, this list is **not** filtered by date and **not** filtered by blocks.

#### TC-A-12 — Activity moderation details
1. `GET /activities/admin/activities/<ACT_1>`. **Expect** `200` with the same detail shape as the member view.
2. `isJoined` and `isFavorite` are `false` and `distanceKm` is `null` — the admin view has no personal context.
3. Unknown / malformed id. **Expect** `404`.

#### TC-A-13 — Approve an activity
1. `PATCH /activities/admin/activities/<ACT_1>/status` `{ "status": "Approved" }`.
2. **Expect** `200 "Activity approved successfully"`, `data.status = "Approved"`, `data.rejectionReason = null`.
3. As a Member, `GET /activities` — ACT_1 now appears.
4. As a Member, joining now succeeds.
5. `GET /dashboard/statistics` — `pendingApprovals` decreased by 1.

#### TC-A-14 — Reject an activity
1. `PATCH /activities/admin/activities/<ACT_2>/status`
```json
{ "status": "Rejected", "rejectionReason": "Location details are incomplete." }
```
2. **Expect** `200 "Activity rejected successfully"`, `status: "Rejected"`, `rejectionReason` stored.
3. As the organizer, `GET /activities/my-activities` shows it as `Rejected`; `GET /activities/:id` exposes the reason so the organizer can act on it.
4. It does not appear in Discover and cannot be joined.
5. **Reason is cleared on approval:** approve the same activity afterwards and confirm `rejectionReason` becomes `null`.
6. Rejecting **without** a reason is allowed (`rejectionReason` is optional) — confirm `200` and a `null` reason.

#### TC-A-15 — Status transition validation
| Body | Expected |
|---|---|
| `{ "status": "Pending" }` | `400` — only `Approved` and `Rejected` are accepted |
| `{ "status": "Draft" }` | `400` |
| `{ "status": "Cancelled" }` | `400` |
| Omit `status` | `400` |
| Unknown activity id | `404 "Activity not found"` |

#### TC-A-16 — Delete any activity (admin)
1. Set up: an activity with participants and favourites.
2. `DELETE /activities/admin/activities/<id>`. **Expect** `200 "Activity deleted successfully"`.
3. Same cascade as TC-O-08: participants and favourites are removed, and the activity disappears from every member's joined and favourite lists.
4. Delete again. **Expect** `404`.

#### TC-A-17 — Categories table
1. `GET /categories/admin/categories`. **Expect** `200` with `data.stats` and `data.categories`, plus `meta`.
2. `stats`: `{ totalCategories, activeNow, pendingReview }` — computed over the **whole** collection, not the current page.
3. Each row: `{ id, categoryName, status, activityCount, proposedBy, createdAt }`. `proposedBy` is `{ id, firstName, lastName }` for a user-proposed category, `null` for a seeded or admin-created one.
4. Newest first — a review queue is read from the top.
5. `?status=Pending` isolates the review queue; `?search=foot` filters by name; `?page`/`?limit` paginate.

#### TC-A-18 — Category CRUD
1. **Create:** `POST /categories/admin/categories` `{ "categoryName": "Yoga" }`. **Expect** `201` and `status: "Active"` — an admin-created category is live immediately (contrast with a member proposal, which is `Pending`).
2. Duplicate name (any casing). **Expect** `409 "Category with this name already exists"`.
3. Name under 2 characters or over 100. **Expect** `400`.
4. **Rename:** `PATCH /categories/admin/categories/<id>` `{ "categoryName": "Gentle Yoga" }`. **Expect** `200`.
5. **Disable:** `PATCH .../<id>` `{ "status": "Disabled" }`. **Expect** `200`; the chip disappears from `GET /categories`, **but** an activity already using it still renders its name in `GET /activities/:id`.
6. **Re-enable:** `{ "status": "Active" }`. The chip returns.
7. **Delete (empty category):** `DELETE /categories/admin/categories/<Yoga id>`. **Expect** `200`.
8. **Delete (in use):** create an activity in a category, then delete that category. **Expect** `409 "Category has activities. Disable it instead of deleting."`
9. Unknown id on any of these. **Expect** `404 "Category not found"`.

#### TC-A-19 — Approve / reject a proposed category
1. A member proposes "Pétanque" (TC-M-13). `GET /categories/admin/categories?status=Pending` shows it with `proposedBy` filled in.
2. **Approve:** `PATCH /categories/admin/categories/<id>/status` `{ "status": "Active" }`. **Expect** `200`; the chip now appears in the public `GET /categories`.
3. **Reject:** on another proposal, `{ "status": "Disabled" }`. **Expect** `200`. The category is **kept, not deleted** — the activity that introduced it still points at it and must keep rendering its name.
4. `{ "status": "Pending" }`. **Expect** `400 "status must be Active (approve) or Disabled (reject)"` — putting a row back into the queue it just left is not a review decision.

#### TC-A-20 — Compose a broadcast to Everyone
1. Prerequisites: at least one member with `status: Active` and `allowNotifications: true`; one with `allowNotifications: false`; one with `status: Blocked`.
2. `POST /notifications/admin/notifications`
```json
{ "notificationTitle": "Autumn programme is live",
  "messageContent": "New walking and swimming groups have opened near you." }
```
3. **Expect** `201 "Notification sent successfully"`, `data.status = "Delivered"`, `data.audience = "Everyone"`, `data.sentDate`, and a `recipientCount`.
4. **Verify the recipient rules.** Recipients are exactly the users where `role = User` **AND** `status = Active` **AND** `allowNotifications = true`. Confirm the opted-out user and the blocked user did **not** receive it, and that `recipientCount` matches the number who did.
5. As a recipient, `GET /notifications` — the message is there, unread.

#### TC-A-21 — Compose a targeted broadcast
1. `POST /notifications/admin/notifications`
```json
{ "notificationTitle": "Swimming season",
  "messageContent": "Lane bookings open Monday.",
  "audience": "Interests",
  "audienceCategoryIds": ["<Swimming id>"] }
```
2. **Expect** `201`. Only members whose stored interests include Swimming (and who pass the Active + allowNotifications rules) receive it.
3. **A segment matching nobody is not a failure:** target a category no one has chosen. **Expect** `201`, `status: "Delivered"`, `recipientCount: 0`. This is the difference between "the audience is empty" and "the send broke".
4. Validation:

| Body | Expected |
|---|---|
| `audience: "Interests"` with no `audienceCategoryIds` | `400 "audience \"Interests\" requires at least one audienceCategoryId"` |
| `audience: "Everyone"` **with** `audienceCategoryIds` | `400 "audienceCategoryIds is only valid with audience \"Interests\""` |
| An unknown category id in the array | `400 "One or more audience categories do not exist"` |
| A malformed id in the array | `400` |
| More than 50 ids | `400` (ArrayMaxSize) |
| `audience: "Seniors"` or `"Volunteers"` | `400` — these were **retired**; nothing on the user document could resolve them, so every such broadcast silently went to everyone |
| Missing `notificationTitle` or `messageContent` | `400` |
| `notificationTitle` over 200 characters | `400` |

5. Duplicate ids in `audienceCategoryIds` are de-duplicated before the segment is stored.

#### TC-A-22 — Notification history
1. `GET /notifications/admin/notifications`. **Expect** `200` + `meta`, newest first.
2. Each row carries the title, message, audience, `audienceCategoryIds`, `recipientCount`, `status` (`Delivered` / `Failed`) and `sentDate`.
3. `?audience=Interests` and `?status=Delivered` filter the history.
4. `?audience=Nonsense`. **Expect** `400`.

#### TC-A-23 — Contact Us information
1. `GET /contact/admin/contact`. **Expect** `200` with `{ id, email, phoneNumber, createdAt, updatedAt }`.
2. `PATCH /contact/admin/contact` `{ "email": "help@arooby.io", "phoneNumber": "+41225550000" }`. **Expect** `200`.
3. Send only one field — the other is untouched.
4. `GET /contact` **with no token** now returns the new values, proving the public page is driven by this record.
5. `{ "email": "nope" }`. **Expect** `400`.
6. This is a **singleton** — repeated updates edit the same record; no second row is ever created.

#### TC-A-24 — Admin acting as an ordinary user
The admin account also has a profile. Confirm these all work with ADMIN_TOKEN:
`GET /users/me`, `PATCH /users/me`, `PATCH /users/me/profile-photo`, `POST /uploads`, `POST /auth/change-password`, `GET /categories`, `GET /activities`, `POST /activities`.

---

## 12. Role 6 — Admin (Dashboard UI)

The React admin dashboard at `http://localhost:5173`. **Before testing, set `VITE_USE_MOCKS=false` (Section 5.4)** or you will be testing the in-memory mock, not the API.

### 12.1 Screen map

| Route | Screen | Backing endpoints |
|---|---|---|
| `/login` | Admin Login | `POST /auth/admin/login` |
| `/forgot-password` | Forget password? | `POST /auth/forgot-password` |
| `/reset-password` | Reset Password | `POST /auth/reset-password` |
| `/dashboard` | Dashboard home | statistics, category-distribution, recent-users, recent-activities, activity status |
| `/users` | Users table | `GET /users/admin/users`, `PATCH .../status` |
| `/users/:userId` | User Details | `GET /users/admin/users/:id`, `PATCH .../status` |
| `/activities` | Activities table | admin activities list, status, delete, active categories |
| `/activities/:activityId` | Activity Details | `GET /activities/admin/activities/:id` |
| `/categories` | Activity Categories | `GET /categories/admin/categories` |
| `/categories/new` | Add Category | `POST /categories/admin/categories` |
| `/notifications` | Notifications | history + compose |
| `/settings` | Settings | **local only — not persisted** (see §16) |
| `/profile` | Profile | `POST /uploads`, `PATCH /users/me/profile-photo` |

Sidebar order: Dashboard, Users, Activities, Categories — divider — Notifications, Settings, Profile, Logout.

### 12.2 Manual test script — Dashboard UI

#### TC-U-01 — Login screen
1. Open `http://localhost:5173`. **Expect** a redirect to `/login` (no token stored).
2. Enter `admin@contenthub.io` / `admin123`, press **Login**.
3. **Expect** a redirect to `/dashboard`, the sidebar rendered, and the admin's name/avatar in the top bar.
4. The show/hide password eye toggles the field between masked and plain.
5. **Remember Me** ticked sends `rememberMe: true` (a 90-day refresh token). Verify in the Network tab.
6. Wrong password. **Expect** the inline error `"Invalid email or password."` and no navigation.
7. A **member's** credentials. **Expect** an error — the dashboard must not admit a non-admin.

#### TC-U-02 — Route protection
1. While signed out, type `http://localhost:5173/users` in the address bar.
2. **Expect** a redirect to `/login` (`ProtectedRoute` guards every dashboard route).
3. Repeat for `/dashboard`, `/activities`, `/categories`, `/notifications`, `/settings`, `/profile`.
4. An unknown path (e.g. `/nonsense`) redirects to `/dashboard`.
5. Signed in, `/` redirects to `/dashboard`.

#### TC-U-03 — Forgot / reset password (UI)
1. On `/login`, follow **"Forget password?"** to `/forgot-password`.
2. Enter the admin e-mail, press **Send Reset Code**. **Expect** a success state and navigation to `/reset-password`.
3. An unknown e-mail shows `"No account found with this email"`.
4. On `/reset-password`, enter the code from the API console plus a new password twice, press **Reset Password**. **Expect** success and a return to login.
5. Mismatched passwords show `"Passwords do not match."`
6. A wrong code shows `"Invalid or expired verification code"`.
7. **Known UI/API divergence:** the form validates `"Password must have 6-8 characters."` while the API enforces **no maximum**. A 12-character password is rejected by the form but would be accepted by the API. Log this against §16.

#### TC-U-04 — Dashboard home
1. **Stat cards** show `totalUsers`, `totalActivities`, `totalRegistrations`, `pendingApprovals`. Cross-check against `GET /dashboard/statistics`.
2. **Category Distribution** renders one row per category with its percentage, highest first.
3. **Recent Users** shows up to 4 members who joined in the last 24 hours. **On a database with no sign-ups today this section is legitimately empty** — register a member and refresh to populate it.
4. **Recent Activities** shows up to 8 of the newest activities with their status badges.
5. Approve or reject a pending activity from this screen. **Expect** the badge to change and the stat cards to refresh (RTK Query invalidates the `Dashboard` tag).

#### TC-U-05 — Users screen
1. Open `/users`. **Expect** a paginated table: avatar, name, e-mail, country, activity count, status badge, date joined.
2. The tabs **All Users / Active Users / Blocked Users** filter the table; confirm the request query changes in the Network tab.
3. The search box (`"Search by name, email or country..."`) filters on typing.
4. The row action menu offers **Block user** / **Unblock user** (and approve/reject actions for pending accounts). Use it and confirm both the badge and the API call.
5. Pagination moves between pages and the row count matches `meta.total`.
6. Clicking a row opens `/users/:userId`.

#### TC-U-06 — User Details screen
1. **Expect** the header (avatar, name, status), **Email Address**, **Phone** (`"Not provided"` when null), **Member Since**.
2. Stat tiles: **Activities Created**, **Activities Joined**.
3. Two lists: **Created Activities** and **Joined Activities**, each with category, date and status.
4. The **Block user** / **Unblock user** action updates the status and the badge.
5. The back arrow returns to `/users`.

#### TC-U-07 — Activities screen
1. Open `/activities`. **Expect** the tabs **Pending / Approved / Rejected**, a category filter dropdown, and a paginated table.
2. Switching tabs changes the `status` query parameter.
3. The category dropdown is populated from `GET /categories` (**active categories only** — a Pending category will not be offered as a filter).
4. **Approve** a pending activity → badge becomes Approved; it leaves the Pending tab.
5. **Reject** an activity → badge becomes Rejected. If the UI collects a reason, confirm it reaches `rejectionReason` in the request body.
6. **Delete** an activity → it disappears; confirm via the API that its participants and favourites went with it.
7. Clicking a row opens `/activities/:activityId`.

#### TC-U-08 — Activity Details screen
1. **Expect** photo, name, category, date/time, location, **Duration**, **Participants** (`"3/10"`), **Age Range**, **Price**, difficulty, equipment, descriptions, organizer, and the status badge (`Pending Review` for pending).
2. All values match `GET /activities/admin/activities/:id`.
3. The back arrow returns to `/activities`.

#### TC-U-09 — Categories screen
1. Open `/categories`. **Expect** the stat row (total / active / pending review) and a paginated table: category name, activity count, status.
2. Counts match `GET /categories/admin/categories`.
3. **Add Category** navigates to `/categories/new`.
4. **Known gap:** this screen is currently **read-only** — it wires only the list query, with no edit, disable, approve/reject or delete actions. Those operations exist in the API and must be exercised through Postman (TC-A-18, TC-A-19). Log against §16.

#### TC-U-10 — Add Category screen
1. Open `/categories/new`, type a name, press **Save and continue**.
2. **Expect** the button to show `"Saving…"`, then a redirect to `/categories` with the new row present and status `Active`.
3. Submit an empty name. **Expect** the inline error `"Category name is required."` and no request sent.
4. Submit a name that already exists. **Expect** the API's `409` surfaced as an error, and no navigation.
5. **Cancel** returns to `/categories` without saving.

#### TC-U-11 — Notifications screen
1. Open `/notifications`. **Expect** the compose card plus the history table.
2. Choose the audience **Everyone**, fill in the title and message, press **Send Notification**.
3. **Expect** `"Sending…"`, then `"Notification sent."`, and a new history row at the top.
4. Verify as a member that the message arrived (TC-M-24).
5. Send with an empty title or message. **Expect** `"Add a title and a message before sending."` and no request.
6. Choose the audience **Interests** and pick categories. Confirm the request carries `audience: "Interests"` and `audienceCategoryIds`. **Known gap:** the dashboard's compose mutation is typed to send title, message and audience only — if `audienceCategoryIds` is missing from the request body, the API will reject it with a 400. Verify in the Network tab and log against §16.
7. Filter the history with the audience/status controls if wired; otherwise note them as display-only.
8. Force a failure (stop the API, then send). **Expect** `"Could not send the notification."`

#### TC-U-12 — Settings screen
1. Open `/settings`. **Expect** **Language**, **Date format**, **Notification sounds**.
2. Change a value and reload the page.
3. **Known gap:** this screen has **no API wiring** — nothing is persisted, and `PATCH /users/me/app-preferences` is never called. Any change is lost on reload. Log against §16.

#### TC-U-13 — Profile screen
1. Open `/profile`. **Expect** the admin's avatar and details.
2. Press **Change photo**, pick a JPG/PNG/WebP.
3. **Expect** `"Uploading…"`, then the new avatar in both the profile and the top bar.
4. Behind the scenes: `POST /uploads` followed by `PATCH /users/me/profile-photo`. Confirm both in the Network tab.
5. Pick a PDF. **Expect** `"Failed to update profile picture"` (the API rejects the MIME type).
6. Pick a file over 25 MB. **Expect** the same failure.

#### TC-U-14 — Logout
1. Press **Logout** in the sidebar.
2. **Expect** a redirect to `/login` and the cleared token.
3. Press the browser Back button. **Expect** to stay on `/login` — `ProtectedRoute` blocks the return.

#### TC-U-15 — Cross-surface consistency
1. Approve an activity in the dashboard; as a member, refresh Discover — it appears.
2. Block a user in the dashboard; that user's next login attempt is refused.
3. Add a category in the dashboard; it shows up in the member `GET /categories` immediately.
4. Send a broadcast in the dashboard; a member's unread count increases.

---
## 13. Business Rules & Negative Test Cases

This section collects the rules that are easy to break and expensive to get wrong. Each has a rule statement, the reason it exists, and how to prove it manually.

### BR-01 — Capacity is exact under concurrency
**Rule.** `joinedCount` may never exceed `maximumNumberOfParticipants`, and never fall below zero.
**Why.** `joinedCount` is denormalised. A read-then-write lets two concurrent joins both see "one seat left" and both take it.
**Proof.** TC-P-03, or `npm run test:race`. Both a capacity race and a same-user double-join race must resolve to exactly one success.

### BR-02 — A removal must stick; a departure must not
**Rule.** `ParticipantStatus.Removed` bars re-joining (403). `Cancelled` does not.
**Why.** Removal is the organizer's decision. If pressing Join again undid it, the feature would be decorative.
**Proof.** TC-O-09 steps 5, and TC-P-05 step 7.

### BR-03 — Removing a participant is not a block
**Rule.** Ejecting someone from an activity must not create a block.
**Why.** A block is bidirectional and account-wide: it would hide every one of the organizer's activities from that user, and theirs from the organizer, permanently — an enormous invisible consequence for "remove from this event", and one that un-removing would not undo.
**Proof.** TC-O-09 step 9.

### BR-04 — Blocks are bidirectional and hide feeds, not direct lookups
**Rule.** If A blocks B, neither sees the other's activities in Discover, Featured, Summary or Suggestions. Direct lookup by id still works.
**Proof.** TC-M-27.

### BR-05 — Deleting an activity deletes its dependents
**Rule.** Deleting an activity (organizer or admin) also deletes its participant rows and favourites.
**Why.** MongoDB has no cascading delete; orphans would surface as broken rows in members' joined and favourite lists.
**Proof.** TC-O-08, TC-A-16.

### BR-06 — Editing an approved activity re-enters moderation
**Rule.** Any change to an `Approved` activity sets it back to `Pending`.
**Proof.** TC-O-06 step 3.

### BR-07 — Only the organizer edits, deletes, or ejects
**Rule.** Ownership, not role. Even an admin gets 403 on `PATCH /activities/:id`.
**Proof.** TC-O-07, TC-O-09 step 7.

### BR-08 — Category approval is non-blocking
**Rule.** A `Pending` category is hidden from the public chips but still resolves on the activity that proposed it. Rejection sets `Disabled` and **never deletes** a category an activity points at.
**Why.** The activity that introduced the category still has to render its name.
**Proof.** TC-M-13 step 7, TC-A-19 step 3, TC-A-18 step 8.

### BR-09 — Each identifier is verified on its own
**Rule.** A verified e-mail does not make an unverified phone a usable login, and vice versa.
**Proof.** TC-G-15 step 3.

### BR-10 — Editing a phone re-derives and un-verifies it
**Rule.** `PATCH /users/me` with a new phone re-derives `phoneE164` and clears `isPhoneVerified`.
**Why.** Otherwise the account keeps signing in with its old number while claiming one it never proved.
**Proof.** TC-M-03 step 3.

### BR-11 — Phone numbers are always normalised
**Rule.** `"+41"/"079..."` and `"+41"/"79..."` are the same subscriber. `phoneE164` carries the unique index.
**Proof.** TC-G-15 step 4.

### BR-12 — Unknown numbers are never sent an SMS
**Rule.** `POST /auth/phone/request-otp` without a token refuses a number no account owns.
**Why.** Otherwise it is an SMS-bombing endpoint aimed at third parties, billed to this project's Twilio account.
**Proof.** TC-G-14 row 1.

### BR-13 — OTP codes are single-use and rate-limited
**Rule.** A code cannot be redeemed twice; limits are counted on request logs, not on the codes themselves.
**Why.** Counting codes would let an attacker refill their budget by letting codes expire.
**Proof.** TC-G-09, TC-G-10.

### BR-14 — Password reset kills every session; a password change does not
**Rule.** `reset-password` clears the stored refresh token. `change-password` does not.
**Proof.** TC-G-16 step 6, TC-M-09 step 7.

### BR-15 — Login errors do not reveal whether an account exists
**Rule.** A wrong password and an unknown identifier return the same message.
**Proof.** TC-G-12 rows 1–2.

### BR-16 — Broadcast recipients are Active + opted-in members only
**Rule.** `role = User` AND `status = Active` AND `allowNotifications = true`. An empty segment is `Delivered` with `recipientCount: 0`, not `Failed`.
**Proof.** TC-A-20 step 4, TC-A-21 step 3.

### BR-17 — Audience and targets must agree
**Rule.** `Interests` requires at least one category id; `Everyone` forbids them.
**Why.** Stray ids on an `Everyone` broadcast would look like targeting that silently did nothing; `Interests` with no categories would report success and reach no one.
**Proof.** TC-A-21 step 4.

### BR-18 — `Seniors` and `Volunteers` audiences are retired
**Rule.** Both are rejected. Nothing on the user document could resolve them, so every such broadcast silently went to everyone.
**Note.** A database created before this change needs `npm run db:migrate-audience` once.

### BR-19 — Geo parameters are bounded
**Rule.** `maxDistance >= 0`, `latitude` in [-90, 90], `longitude` in [-180, 180].
**Why.** These values reach Mongo geo operators unaltered; an out-of-range value makes the driver throw, which surfaces as a 500 carrying a raw database message.
**Proof.** TC-M-14 steps 5–6, TC-M-18.

### BR-20 — Paginated geo queries stay consistent
**Rule.** `meta.total` must agree with the rows returned for the same radius.
**Why.** The find sorts by distance with one operator while the count uses another; a mismatch means the two describe different circles.
**Proof.** TC-M-19 last row.

### BR-21 — Autocomplete matches partial words
**Rule.** `q=swi` must return "Swimming".
**Why.** Deliberately not a text index — text indexes match whole words, which is the one thing an autocomplete must not do.
**Proof.** TC-M-20 step 1.

### BR-22 — Malformed ids give 404, never 500
**Rule.** Every route param goes through `ParseObjectIdPipe`, and every body/query id through `@IsObjectId()`.
**Proof.** TC-M-21 step 5, TC-P-02, TC-A-09 step 3.

### BR-23 — Unknown request fields are stripped
**Rule.** The global `ValidationPipe({ whitelist: true })` removes properties no DTO declares — including `role` and `status`.
**Proof.** TC-M-03 step 6.

### BR-24 — Literal routes resolve before `:id`
**Rule.** `/activities/summary` must hit the summary handler, not be parsed as an ObjectId.
**Proof.** Call `GET /activities/summary`, `/featured`, `/suggestions?q=ab`, `/my-activities`, `/joined-activities` and confirm none returns "Activity not found".

### BR-25 — Blocked and Suspended accounts cannot sign in; Inactive can
**Rule.** Only `Blocked` and `Suspended` are refused at login.
**Proof.** TC-A-10 steps 3–6.

### 13.1 Cross-cutting negative sweep
Run once per release:

| Sweep | How | Expected |
|---|---|---|
| No token | Every non-public route | `401 "Access token is missing"` |
| Garbage token | `Authorization: Bearer abc` | `401 "Invalid or expired access token"` |
| Expired token | Set `JWT_ACCESS_EXPIRES_IN=5s`, wait, retry | `401` |
| Member token on all 20 admin routes | TC-A-03 | `403` |
| Malformed ObjectId in every `:id` route | `/abc` | `404`, never 500 |
| Empty body `{}` on every POST/PATCH | — | `400` where fields are required, `200` where all fields are optional |
| `limit=99999` on every list | — | Clamped to 100 |
| `page=0` / `page=-1` | — | Treated as page 1 |
| Regex metacharacters in every `search` | `?search=.*` | Treated as literal text |

---

## 14. Data Model

Collections are snake_case; document fields stay camelCase, matching the API surface.

### 14.1 Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Accounts (members and admins) | `firstName`, `lastName`, `email`, `password` (never selected), `phoneCountryCode`, `phoneNumber`, `phoneE164`, `isEmailVerified`, `isPhoneVerified`, `dateOfBirth`, `language`, `profilePhoto`, `country`, `region`, `city`, `latitude`, `longitude`, `location` (GeoJSON), `role`, `status`, `dateFormat`, `notificationSounds`, `allowNotifications`, `acceptedTermsAt`, `refreshToken` (never selected), `createdAt` (exposed as `memberSince`), `updatedAt` |
| `categories` | Activity categories | `categoryName`, `status`, `proposedBy`, timestamps |
| `activities` | Activities | `activityName`, `categoryId`, `descriptions`, `maximumNumberOfParticipants`, `joinedCount`, `activityPhoto`, `activityDate`, `activityTime`, `activityDuration`, `activityEquipment`, `activityLocation`, `latitude`, `longitude`, `location` (GeoJSON), `minAge`, `maxAge`, `price`, `difficulty`, `status`, `rejectionReason`, `organizerId`, timestamps |
| `activity_participants` | Memberships | `activityId`, `userId`, `status`, `joinedAt` |
| `favorites` | Saved activities | `activityId`, `userId` |
| `user_interests` | Chosen interests | `userId`, `categoryId` |
| `blocked_users` | Personal blocks | `blockerId`, `blockedId` |
| `notifications` | Broadcasts | `notificationTitle`, `messageContent`, `audience`, `audienceCategoryIds`, `recipientCount`, `status`, `sentBy`, `sentDate` |
| `user_notifications` | Per-user delivery rows | `notificationId`, `userId`, `isRead`, `readAt` |
| `otps` | Live codes | `identifier`, `channel`, `otpCode`, `type`, `isUsed`, `expiresAt` (TTL-reaped) |
| `otp_request_logs` | Rate-limit ledger | `identifier`, `channel`, `ip`, `createdAt` |
| `contact_info` | Contact Us singleton | `email`, `phoneNumber` |

### 14.2 Enumerations

| Enum | Values |
|---|---|
| `UserRole` | `User`, `Admin` |
| `UserStatus` | `Pending`, `Active`, `Inactive`, `Suspended`, `Blocked` |
| `ActivityStatus` | `Draft`, `Pending`, `Approved`, `Rejected`, `Cancelled`, `Completed` |
| `CategoryStatus` | `Active`, `Disabled`, `Pending` |
| `Difficulty` | `Beginner`, `Intermediate`, `Advanced` |
| `ParticipantStatus` | `Joined`, `Cancelled`, `Removed` |
| `NotificationAudience` | `Everyone`, `Interests` |
| `NotificationStatus` | `Delivered`, `Failed` |
| `OtpType` | `VerifyEmail`, `VerifyPhone`, `PhoneLogin`, `ResetPassword` |
| `OtpChannel` | `Email`, `Sms` |
| `ActivityTab` | `All`, `Upcoming`, `Past` |

### 14.3 Indexes that matter for testing
- `users.email` and `users.phoneE164` — unique **partial** indexes (`$type: 'string'`), not sparse. This is what allows many accounts to sit at `email: null` (phone-only) or `phoneE164: null` (email-only) while still rejecting a duplicate.
- `activity_participants (activityId, userId)` — unique. It is what makes the concurrent-join test resolve to a single winner.
- `activities.location` and `users.location` — 2dsphere, required by every distance query.
- Changing index **options** requires `npm run db:sync-indexes`; Mongo will not rebuild in place.

### 14.4 Relationships
```
users 1───* activities        (organizerId)
users *───* activities        via activity_participants
users *───* activities        via favorites
users *───* categories        via user_interests
users *───* users             via blocked_users (blockerId / blockedId)
categories 1───* activities   (categoryId)
categories 1───* categories   proposedBy -> users
notifications 1───* user_notifications ───1 users
```

---

## 15. Non-Functional Requirements

| # | Requirement | How to verify |
|---|---|---|
| NFR-1 | Passwords are bcrypt-hashed (cost 10) and never returned | Inspect a user document; confirm no `password` field in any response |
| NFR-2 | Refresh tokens are stored hashed and never returned on reads | Inspect a user document |
| NFR-3 | Access tokens expire per `JWT_ACCESS_EXPIRES_IN` (default 1 day); refresh per `JWT_REFRESH_EXPIRES_IN` (default 30 days, 90 with Remember Me) | Set a short expiry and confirm the 401 |
| NFR-4 | Every response uses the standard envelope | Spot-check across modules |
| NFR-5 | No raw database error text ever reaches a client | Run the whole malformed-input sweep in §13.1; every result must be a 4xx with a human message |
| NFR-6 | Lists are paginated with `limit` capped at 100 | `?limit=99999` |
| NFR-7 | Distance queries use geospatial indexes, not in-memory filtering | Response times stay flat as the dataset grows |
| NFR-8 | Uploads are limited to jpg/png/webp, max 25 MB | TC-M-07 |
| NFR-9 | OTP delivery is rate-limited per identifier and per IP, on both channels | TC-G-10, TC-G-14 |
| NFR-10 | CORS is restricted in production via `CORS_ORIGINS`; unset means allow-all for local dev | Set the variable and confirm a disallowed origin is refused |
| NFR-11 | TypeScript strict mode compiles clean | `npm run build` and `npm run typecheck` |
| NFR-12 | The database runs as a replica set so transactions are available | `docker compose ps` reports healthy after rs0 initiates |
| NFR-13 | Secrets live in `.env` and are never committed | `.env` is git-ignored |
| NFR-14 | Automated regression suites pass | `npm run test:all` |
| NFR-15 | Dashboard routes are guarded client-side and every data route is guarded server-side | TC-U-02 plus TC-A-03 |

---

## 16. Deliberate Departures & Known Gaps

### 16.1 Deliberate departures from the Figma designs
| Design says | Implementation | Reason |
|---|---|---|
| Reset Password: "6-8 characters" | Minimum 6, **no maximum** | An 8-character ceiling makes strong passwords impossible; the seed data's own `password123` would be invalid |
| OTP screens draw 5 boxes | The API issues and validates **6** digits | Consistency across every OTP flow |
| Notification audience includes Seniors / Volunteers | Only `Everyone` and `Interests` | Nothing on the user document could resolve those segments, so every such broadcast silently went to everyone |
| Category has an icon | `categoryName` only | No icon field exists in the data model |

### 16.2 Known gaps found while writing this document
These are behaviours a tester will hit; they are recorded so they are not re-reported as new bugs.

| # | Gap | Impact on testing |
|---|---|---|
| GAP-1 | **Dashboard mocks are on by default in `npm run dev`.** | Without `VITE_USE_MOCKS=false` you are testing an in-memory fake, not the API. |
| GAP-2 | **Settings screen is not wired to any endpoint.** | Language / date format / notification sounds are not persisted. `PATCH /users/me/app-preferences` must be tested via Postman. |
| GAP-3 | **Categories screen is read-only.** | Edit, disable, approve/reject and delete exist in the API but have no UI. Test them via Postman (TC-A-18, TC-A-19). |
| GAP-4 | **Compose-notification UI does not send `audienceCategoryIds`.** | An `Interests` broadcast from the dashboard will be rejected with 400 unless the ids are included. Verify in the Network tab. |
| GAP-5 | **Reset Password form enforces a 6–8 character maximum** the API does not. | A 12-character password is refused by the form only. |
| GAP-6 | **`ActivityStatus.Cancelled` and `Completed` are unreachable.** | No endpoint produces them; there is no "cancel my activity" action distinct from delete, and nothing marks past activities complete. |
| GAP-7 | **No admin endpoint edits an activity.** | Admins may only approve, reject or delete. `PATCH /activities/:id` returns 403 for an admin. |
| GAP-8 | **`UserStatus.Inactive` has no effect on login.** | Only `Blocked` and `Suspended` are refused. `Inactive` users are, however, excluded from broadcasts. |
| GAP-9 | **Account status is checked at login, not per request.** | A token issued before a block keeps working until it expires. |
| GAP-10 | **Notifications are database rows only.** | There is no push or e-mail delivery; a client must poll `GET /notifications`. |
| GAP-11 | **Logout does not invalidate the access token.** | Only the refresh token is cleared — inherent to stateless JWT. |
| GAP-12 | **`GET /categories` is not public.** | A signed-out client cannot render category chips. Intentional today; note if the mobile app needs them pre-login. |

---

## 17. Manual Test Sign-Off Checklists

Print or copy these. Record Pass / Fail / Blocked plus the build and date.

### 17.1 Guest (20 cases)
- [ ] TC-G-01 Health check
- [ ] TC-G-02 Public contact info
- [ ] TC-G-03 Register with e-mail
- [ ] TC-G-04 Register with phone only
- [ ] TC-G-05 Register with both identifiers
- [ ] TC-G-06 Registration validation failures
- [ ] TC-G-07 Duplicate vs. unverified re-registration
- [ ] TC-G-08 Verify OTP
- [ ] TC-G-09 OTP negative cases
- [ ] TC-G-10 Resend OTP and cooldown
- [ ] TC-G-11 Login with e-mail
- [ ] TC-G-12 Login negative cases
- [ ] TC-G-13 Passwordless phone sign-in
- [ ] TC-G-14 Phone OTP negative cases
- [ ] TC-G-15 Login with phone + password
- [ ] TC-G-16 Forgot / reset password
- [ ] TC-G-17 Reset password negative cases
- [ ] TC-G-18 Refresh token rotation
- [ ] TC-G-19 Protected routes reject a Guest
- [ ] TC-G-20 Guest cannot use admin login

### 17.2 Member (27 cases)
- [ ] TC-M-01 View profile
- [ ] TC-M-02 Completeness ring
- [ ] TC-M-03 Edit profile (incl. phone re-verification, whitelist)
- [ ] TC-M-04 Set location
- [ ] TC-M-05 Choose interests
- [ ] TC-M-06 Profile photo
- [ ] TC-M-07 Upload negative cases
- [ ] TC-M-08 App preferences
- [ ] TC-M-09 Change password
- [ ] TC-M-10 Link a phone number
- [ ] TC-M-11 Logout
- [ ] TC-M-12 List active categories
- [ ] TC-M-13 Propose a category
- [ ] TC-M-14 Home hero summary
- [ ] TC-M-15 Featured this weekend
- [ ] TC-M-16 Discover default list
- [ ] TC-M-17 Discover search
- [ ] TC-M-18 Apply Filter sheet
- [ ] TC-M-19 The three tab feeds
- [ ] TC-M-20 Search autocomplete
- [ ] TC-M-21 Activity details
- [ ] TC-M-22 Participants list
- [ ] TC-M-23 Favourites
- [ ] TC-M-24 Receive a broadcast
- [ ] TC-M-25 Interest-targeted broadcast
- [ ] TC-M-26 Block a user
- [ ] TC-M-27 What a block hides

### 17.3 Organizer (9 cases)
- [ ] TC-O-01 Create and submit
- [ ] TC-O-02 Inline new category
- [ ] TC-O-03 Draft then submit
- [ ] TC-O-04 Create validation failures
- [ ] TC-O-05 My Activities tabs
- [ ] TC-O-06 Edit (incl. re-moderation)
- [ ] TC-O-07 Only the organizer may edit
- [ ] TC-O-08 Delete with cascade
- [ ] TC-O-09 Eject a participant

### 17.4 Participant (6 cases)
- [ ] TC-P-01 Join
- [ ] TC-P-02 Join negative cases
- [ ] TC-P-03 Capacity under concurrency
- [ ] TC-P-04 Joined Activities tabs
- [ ] TC-P-05 Leave and re-join
- [ ] TC-P-06 Connections counter

### 17.5 Admin — API (24 cases)
- [ ] TC-A-01 Admin login
- [ ] TC-A-02 Admin login negative cases
- [ ] TC-A-03 Role guard on all 20 admin routes
- [ ] TC-A-04 Statistics
- [ ] TC-A-05 Category distribution
- [ ] TC-A-06 Recent users
- [ ] TC-A-07 Recent activities
- [ ] TC-A-08 Users table + filters
- [ ] TC-A-09 User details
- [ ] TC-A-10 Change user status
- [ ] TC-A-11 Activities moderation list
- [ ] TC-A-12 Activity moderation details
- [ ] TC-A-13 Approve
- [ ] TC-A-14 Reject with reason
- [ ] TC-A-15 Status transition validation
- [ ] TC-A-16 Admin delete with cascade
- [ ] TC-A-17 Categories table + stats
- [ ] TC-A-18 Category CRUD
- [ ] TC-A-19 Approve / reject a proposal
- [ ] TC-A-20 Broadcast to Everyone
- [ ] TC-A-21 Targeted broadcast + validation
- [ ] TC-A-22 Notification history
- [ ] TC-A-23 Contact Us info
- [ ] TC-A-24 Admin as an ordinary user

### 17.6 Admin — Dashboard UI (15 cases)
- [ ] TC-U-01 Login
- [ ] TC-U-02 Route protection
- [ ] TC-U-03 Forgot / reset password
- [ ] TC-U-04 Dashboard home
- [ ] TC-U-05 Users screen
- [ ] TC-U-06 User Details
- [ ] TC-U-07 Activities screen
- [ ] TC-U-08 Activity Details
- [ ] TC-U-09 Categories screen
- [ ] TC-U-10 Add Category
- [ ] TC-U-11 Notifications
- [ ] TC-U-12 Settings
- [ ] TC-U-13 Profile
- [ ] TC-U-14 Logout
- [ ] TC-U-15 Cross-surface consistency

### 17.7 Business rules (25 checks)
- [ ] BR-01 Capacity under concurrency
- [ ] BR-02 Removal sticks, departure does not
- [ ] BR-03 Removal is not a block
- [ ] BR-04 Blocks are bidirectional
- [ ] BR-05 Delete cascades
- [ ] BR-06 Approved edit re-enters moderation
- [ ] BR-07 Ownership beats role
- [ ] BR-08 Category approval is non-blocking
- [ ] BR-09 Per-identifier verification
- [ ] BR-10 Phone edit un-verifies
- [ ] BR-11 Phone normalisation
- [ ] BR-12 No SMS to unknown numbers
- [ ] BR-13 OTP single-use + limits
- [ ] BR-14 Reset kills sessions, change does not
- [ ] BR-15 Login errors do not enumerate accounts
- [ ] BR-16 Broadcast recipient rules
- [ ] BR-17 Audience/target agreement
- [ ] BR-18 Retired audiences rejected
- [ ] BR-19 Geo bounds
- [ ] BR-20 Paginated geo consistency
- [ ] BR-21 Partial-word autocomplete
- [ ] BR-22 Malformed ids give 404
- [ ] BR-23 Unknown fields stripped
- [ ] BR-24 Literal routes before `:id`
- [ ] BR-25 Blocked/Suspended refused, Inactive allowed

### 17.8 Suggested end-to-end regression run (about 45 minutes)
1. `docker compose up -d`, `npm run db:sync-indexes`, `npm run seed`, `npm run start:dev`.
2. Register and verify ALICE, BOB, CARL; register and verify DANA by phone. *(TC-G-03/04/08/13)*
3. Complete ALICE's onboarding: location, 3 interests, photo. Check completeness reaches 100 %. *(TC-M-04/05/06/02)*
4. ALICE creates two activities — one submitted, one draft. *(TC-O-01, TC-O-03)*
5. Admin approves one, rejects the other with a reason. *(TC-A-13, TC-A-14)*
6. BOB discovers the approved activity by search, filter, and nearby sort; favourites it; joins it. *(TC-M-17/18/19/23, TC-P-01)*
7. CARL joins, then leaves, then re-joins. *(TC-P-05)*
8. ALICE ejects CARL; CARL fails to re-join. *(TC-O-09)*
9. ALICE edits the approved activity; confirm it returns to Pending and leaves Discover. *(TC-O-06)*
10. Admin re-approves; run the concurrency race on a 1-seat activity. *(TC-P-03)*
11. Admin sends one broadcast to Everyone and one to Interests; verify who receives each. *(TC-A-20, TC-A-21, TC-M-24, TC-M-25)*
12. Admin blocks CARL; CARL's login is refused. *(TC-A-10)*
13. ALICE blocks BOB; verify the feeds hide each other both ways. *(TC-M-27)*
14. ALICE deletes her activity; verify participants and favourites are gone. *(TC-O-08)*
15. Run the whole dashboard UI script with `VITE_USE_MOCKS=false`. *(TC-U-01…15)*
16. Run the cross-cutting negative sweep. *(§13.1)*
17. Run `npm run test:all` and record the result.

---

**End of document.**
