# Quick Start — 3 commands

```bash
npm install
npm run dev
```

`.env.local` is already set up with a live Supabase project — the app talks to a real Postgres
backend from the first run, no demo/dummy data. (Delete `.env.local` if you ever want to fall back
to offline demo mode for previewing UI without a backend.)

Open **http://localhost:5173**.

## Try each role

Create real accounts at `/register` (citizen or contractor), or sign in with the demo accounts that
already exist in this Supabase project:

| Email | Password | Role |
|---|---|---|
| `citizen@example.com` | `demo1234` | Citizen dashboard, report form, my reports |
| `contractor@example.com` | `demo1234` | Kanban work queue (assigned / in progress / completed) |
| `admin@example.com` | `demo1234` | Program overview, triage, contractor performance |

## Finish the backend setup

Two SQL files still need to be run once in the Supabase SQL Editor for the Follow and photo-upload
features to work — see `docs/02-SUPABASE.md` step 3: `supabase/05-followers.sql` and
`supabase/06-storage.sql`.

## Verified

- `npx tsc --noEmit` (strict mode) — zero TypeScript errors
- `npm run build` (Vite production) — builds clean
- Live REST check against the configured Supabase project (`defects`, `contractors`, `votes` all
  respond with real rows; RLS correctly blocks anonymous reads of `profiles`)

## Security posture

- Row-level security enabled on every table (`profiles`, `contractors`, `defects`, `repair_updates`, `votes`, `followers`)
- CHECK constraints on `severity`, `status`, `defect_type`
- No secrets in bundle (the anon key is public-safe by design; RLS is the real boundary)
- XSS-safe Leaflet popups (all user content goes through `escapeHtml`)
- Icons use static `dangerouslySetInnerHTML` (never user input)
- No `eval`, no `Function()`, no `innerHTML` on user data
- CSRF-safe (all writes are same-origin fetch with Supabase JWT)
- Photo uploads are scoped per-user by storage path (`{user_id}/...`) and size/type-limited server-side via bucket policy
