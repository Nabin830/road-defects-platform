# Road Defects Assessment Platform — React + TypeScript

A civic infrastructure app for NSW councils. Residents report road defects, contractors fix them, admins triage.

Built for the Central West NSW pilot (Orange, Cabonne, Blayney, Cowra LGAs) as part of the Charles Darwin University PRT631 Information Systems Practicum.

## Stack

- **React 18** + **TypeScript 5** — strict typing throughout
- **Vite 5** — fast dev server and build
- **Tailwind CSS 3** — utility-first styling with CSS-var-based theming
- **React Router 6** — hash-router SPA
- **Zustand 4** — tiny state store for auth + UI
- **Supabase JS 2** — Postgres backend with auth and row-level security
- **Leaflet + React-Leaflet** — OpenStreetMap tiles, custom pins

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. `.env.local` already points at a live Supabase project, so this is a
real backend from the first run — no in-memory dummy data. (An offline demo-data fallback still
exists in `src/lib/api.ts` and activates automatically if `.env.local` is removed or unset, purely
so the UI can be previewed without a backend — it never runs while Supabase is configured.)

## Accounts

Register a real account at `/register` (citizen or contractor), or sign in with the seeded demo
accounts already present in the connected Supabase project:

| Email | Password | Role |
|---|---|---|
| `citizen@example.com` | `demo1234` | Citizen (report defects, follow updates, back reports) |
| `contractor@example.com` | `demo1234` | Contractor (kanban work queue) |
| `admin@example.com` | `demo1234` | Admin (triage, assign, analytics, CSV export) |

Admin accounts and contractor↔company links are granted via a one-line SQL update by an existing
admin, not via self-registration — see `docs/02-SUPABASE.md`.

Two SQL files add the last two real features (run once in the Supabase SQL Editor):
`supabase/05-followers.sql` (Follow updates) and `supabase/06-storage.sql` (real photo uploads).

## Project structure

```
road-defects-react/
├─ src/
│  ├─ main.tsx              React entry, mounts App, inits stores
│  ├─ App.tsx               Router — all routes with role guards
│  ├─ index.css             Design tokens + Tailwind + component classes
│  ├─ lib/
│  │   ├─ types.ts          Every shared type (Defect, Profile, Role, …)
│  │   ├─ constants.ts      STATUS, SEVERITY, TYPES, ORANGE (lat/lng)
│  │   ├─ utils.ts          relativeTime, daysAgo, initialsOf, newDefectId
│  │   ├─ icons.tsx         Lucide-style SVG icon set
│  │   ├─ supabase.ts       Typed client + HAS_SUPABASE detection
│  │   └─ api.ts            Data layer — Supabase queries + demo fallback
│  ├─ store/
│  │   ├─ auth.ts           Zustand — session, profile, role, demo mode
│  │   └─ ui.ts             Zustand — theme, toasts, modal host
│  ├─ components/
│  │   ├─ Layout.tsx        Navbar + TabBar + Footer
│  │   ├─ DefectMap.tsx     Leaflet map with severity-colored pins
│  │   ├─ DefectCard.tsx    Card with photo, status, severity, progress
│  │   ├─ Timeline.tsx      Repair-progress timeline
│  │   ├─ StatCard.tsx      Number-with-label card
│  │   ├─ Badge.tsx         StatusBadge
│  │   ├─ Severity.tsx      SeverityChip (with critical pulse)
│  │   ├─ Placeholder.tsx   Dashed image placeholder
│  │   ├─ Toast.tsx         Toast host (4 kinds: success/error/warning/info)
│  │   ├─ Modal.tsx         Modal host (assign/reject dialogs)
│  │   └─ ProtectedRoute.tsx  Guards routes by role
│  └─ pages/
│      ├─ Home.tsx          Landing — hero, stats, how-it-works, recent
│      ├─ Login.tsx         Split-screen login
│      ├─ Register.tsx      Role selector + create account
│      ├─ Dashboard.tsx     Citizen dashboard
│      ├─ Report.tsx        3-step report form (location → details → photo)
│      ├─ Defects.tsx       All defects — filters + map/grid/table views
│      ├─ DefectDetail.tsx  Full defect view — actions by role
│      ├─ MyReports.tsx     Citizen — my own reports
│      ├─ Contractor.tsx    Contractor kanban (assigned/progress/completed)
│      └─ Admin.tsx         Council dashboard — charts, contractors, triage
├─ supabase/
│  ├─ 01-schema.sql         Tables, indexes, triggers
│  ├─ 02-policies.sql       RLS policies (helpers + per-table rules)
│  ├─ 03-seed.sql           17 real Orange defects + 4 contractors
│  ├─ 04-link-users.sql     Promotes demo signups to admin/contractor
│  ├─ 05-followers.sql      "Follow updates" table + RLS
│  └─ 06-storage.sql        defect-photos storage bucket + RLS
├─ docs/                    Setup, Supabase, deployment, troubleshooting
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ .env.example
└─ .gitignore
```

## User flows

### Citizen
1. `/` → `/register` (role = citizen)
2. `/dashboard` shows their stat cards + recent reports + neighbourhood map
3. `/report` — pick location on the map → choose type/severity/title → attach photos → submit
4. `/my-reports` shows all their submissions with filter tabs
5. `/defect/:id` shows full details; the **Follow updates** and **Back this report** buttons are visible

### Contractor
1. `/login` (email starting with `contractor@` in demo mode)
2. `/contractor` shows a kanban with three columns: Assigned / In progress / Completed
3. Click a card → `/defect/:id`
4. **Mark in progress** and **Mark complete** buttons write to the repair timeline

### Admin
1. `/login` (email starting with `admin@`)
2. `/admin` shows the program overview: stat cards, status bar chart, severity breakdown, contractor performance table, live map, pending triage list
3. Click a pending defect → `/defect/:id`
4. **Assign contractor** opens a modal with the panel
5. **Reject report** opens a modal with reason chips + free text

## Design tokens

All theming is driven by CSS custom properties in `src/index.css`:

- **Brand**: `#1E40AF` blue
- **Success (em)**: `#059669` green (completed repairs)
- **Warning (am)**: `#F59E0B` amber (assigned, in progress)
- **Danger (rd)**: `#DC2626` red (critical, rejected)
- **Purple (pu)**: `#7C3AED` (contractor accents)

Both **light** and **dark** themes are supported via the toggle in the navbar. Preference persists in `localStorage`.

## Author

**Nabin Pandey** — PRT631 Information Systems Practicum
Charles Darwin University · 2026

## License

MIT — free to use for research and educational purposes.
