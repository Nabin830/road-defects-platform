![RoadFix](src/Logos/website-header.png)

# RoadFix

RoadFix lets residents of Orange, NSW report potholes and other road damage, and follow each repair from
report to a council-verified fix. Council triages reports and hands them to contractors with a work order
and fix-by date; contractors post progress with photos; council signs the repair off.

Built for the Central West NSW pilot as part of the Charles Darwin University PRT631 Information Systems
Practicum.

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase URL and anon key
npm run dev                    # http://localhost:5173
```

Requires **Node 20+**. Then set up the database: run `supabase/00-all-in-one.sql` once in the Supabase
SQL Editor and turn **Confirm email** off (details in [`docs/02-SUPABASE.md`](docs/02-SUPABASE.md)).

Without Supabase credentials the app runs in an offline **demo mode** (empty, in-memory data) so the UI can
be previewed; it never runs while Supabase is configured.

## Who can do what

| Role | Can |
| --- | --- |
| Visitor | Browse the public map, every report and its repair timeline |
| Resident | Report a defect (location, details, required photo), back and follow reports, get in-app notifications |
| Contractor | Accept or decline jobs, post progress with photos, mark jobs complete (photo required) |
| Council | Triage and re-grade reports, assign contractors with a work order and fix-by date, verify or send back repairs, reject reports, manage people and companies, view reports and export CSV |

Council accounts are granted in the database, never by sign-up. `council@gmail.com` becomes council when
`00-all-in-one.sql` runs, if the account already exists (otherwise see `QUICK_START.md` step 3). RoadFix sends **no emails** — all updates appear in the app.

## Rules the database enforces

Every rule is enforced in Postgres (row-level security + triggers), not just in the browser:

- Stage order: pending → assigned → in progress → completed → verified (no skipping)
- Required photos on reports, progress updates and completion; photo links must point at the RoadFix bucket
- Spam limits (1 report a minute, 10 a day), no new report within 150 m of an open one from the last hour,
  reports only inside the Orange council area, text length limits
- Each role can only change what the app lets it change (no fake votes, severities, dates or council entries)
- Fix-by targets: critical 1 day, high 3–5 days, medium 7, low 10 (or council's own date when assigning)

## Stack

React 18 + TypeScript · Vite 5 · Tailwind CSS 3 · React Router 7 · Zustand · Supabase (Postgres, auth,
storage) · Leaflet + OpenStreetMap

## Project structure

```
src/
  main.tsx            Entry: fonts, theme, auth init, router
  App.tsx             Routes (pages load on demand) + role guards
  index.css           Design tokens (light/dark), component classes
  lib/                api (data layer + demo fallback), supabase client, types, constants,
                      sla (deadlines), geocode (address lookup), image (photo shrinking), seo, utils, icons
  store/              auth, ui (theme/toasts/dialogs), notifications
  components/         Layout, maps (DefectMap → LeafletMap, MapThumb), DefectCard, Timeline, Photo,
                      PhotoField, Modal, Toast, ErrorBoundary, Charts, badges
  pages/              Home, Defects, DefectDetail, Report, Dashboard, MyReports, Contractor,
                      Admin, Reports, People, Profile, Login, Register, Legal (privacy/terms)
  assets/             Web-optimised logos and illustrations
  Logos/              Original brand artwork (not all used by the site)
supabase/
  00-all-in-one.sql   Wipes and builds the whole database (includes everything in 01–07)
  01–07-*.sql         Upgrades for a database whose data you want to keep
  functions/geocode/  Optional Edge Function: cached address lookups
scripts/seo-build.mjs Runs after the build: per-page meta, robots.txt, sitemap.xml
docs/                 Setup, Supabase, deployment, troubleshooting
```

## Design

The palette comes from the logo: light cone-orange (`#FB9A4B`) for actions with charcoal text on top, a
deeper orange (`#B34D0C`) for links, and a warm off-white background (`#FAF8F4`). Status colours: amber
(pending), blue (assigned), purple (in progress), green (completed), red (rejected / critical). Light and dark
themes follow the navbar toggle. Text colours meet WCAG AA contrast.

## Author

**Nabin Pandey** — PRT631 Information Systems Practicum, Charles Darwin University · 2026

## License

MIT — free to use for research and educational purposes.
