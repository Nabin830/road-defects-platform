# Quick Start

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (and VITE_SITE_URL for production)
npm run dev                  # http://localhost:5173
```

Needs **Node 20+**.

## Set up the database (once)

1. Supabase → **SQL Editor** → paste all of `supabase/00-all-in-one.sql` → **Run**.
   It wipes the database and creates everything. No sample data; sign-in accounts are kept.
2. Supabase → **Authentication → Providers → Email** → turn **Confirm email** OFF (RoadFix sends no emails).
3. Council account: if `council@gmail.com` already existed when you ran the SQL, it's council now.
   If you sign it up afterwards, run this once in the SQL Editor:
   `update public.profiles set role = 'admin' where lower(email) = 'council@gmail.com';`

## Try each role

- **Resident:** register at `/register`, then report a defect at `/report`.
- **Contractor:** register choosing "I'm a contractor"; council assigns jobs to your company.
- **Council:** sign in as `council@gmail.com` → `/admin`.

## Checks

- `npm run typecheck` — strict TypeScript
- `npm run build` — production build + SEO files (sitemap needs `VITE_SITE_URL`)

Security details and database rules: see `docs/02-SUPABASE.md`.
