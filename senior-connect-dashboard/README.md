# Senior Connect — Admin Dashboard

React + TypeScript + Vite + Tailwind v4 + Redux Toolkit / RTK Query.

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

## Mock backend

`src/mocks/` contains an in-memory stand-in for the NestJS API. It swaps into
the RTK Query slice in place of `fetchBaseQuery`, speaks the same routes and the
same `{ success, message, data, meta? }` envelope, and persists mutations for
the lifetime of the tab — so the dashboard runs with no API and no database.

| | mocks |
|---|---|
| `npm run dev` | **on** |
| `npm run build` | **off** — talks to `VITE_API_URL` |
| `VITE_USE_MOCKS=true` | forced on |
| `VITE_USE_MOCKS=false` | forced off |

Sign in with `admin@contenthub.io` / `admin123`.

The seed data in `src/mocks/data.ts` reproduces the Figma frames exactly,
including their volumes (12,540 users, 582 rows across 58 pages, 124
notifications), so pagination and the `1 2 3 … 58` pager render as designed.

## Design source of truth

**`../Dashboard figma design/*.svg`** — the current Figma export. Read colours
from the vector `fill` attributes *and* the `<linearGradient>` stops; the
primary accent is a gradient, so it does not appear as a flat fill.

**Do not colour-match against `dashboard figma/*.png`.** Those are a stale
all-green export of the same layouts and disagree with the Figma throughout.
They remain useful only for geometry, which is identical.

To inspect a frame, render the SVG rather than opening the PNG:

```bash
# any SVG renderer; Chromium via Playwright works well
npx playwright screenshot "../Dashboard figma design/Dashboard.svg" out.png
```

### Palette

The design is deliberately two-toned.

**Blue** — app chrome: wordmark, page titles, active nav row, dashboard
widgets, links, and the login CTA. Always `linear-gradient(180deg, #1A9BFE 0%,
#2178FC 100%)` or its flat midpoint `#1E86FD`; tint `#D9EEFF`, active nav row
`#E0F1FF`.

**Green** — content actions and statuses: filled buttons and pagination
`#0B6438`, status dots and borders `#2E7D4F`, Active pill `#C0EFBC` on
`#456E46`.

Note that the Figma is inconsistent here: Categories, Notifications and both
detail screens draw their page title in green rather than blue. That is a
leftover from the recolour, so every title is rendered blue instead.

Typeface is **DM Sans** throughout. Tokens live in `src/index.css`; shell
geometry is documented at the top of `src/layouts/AdminLayout.tsx`.

### Layout

256px sidebar (including its 1px rule), 68px topbar, and a **fluid** content
column with a constant 32px gutter either side. At the frame's 1280px width
that resolves to exactly the 960px column it draws, `288..1248`.

The column is deliberately not frozen at 960 and centred: that opens a gap
beside the sidebar which grows with the window (113px at 1440, 233px at 1680).
Grids that would otherwise stretch — the activity cards — use `auto-fill` so a
wider window buys more columns rather than fatter cards.

Screens with no frame — Settings, Profile, Forgot Password, Reset Password —
follow the system established by the others rather than a reference drawing.
