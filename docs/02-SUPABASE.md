# Supabase Backend Setup

This project uses a Supabase Postgres backend with Row Level Security (RLS).

## 1. Create a project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. Choose the **Sydney (ap-southeast-2)** region
4. Pick a strong database password
5. Wait ~2 minutes for provisioning

## 2. Get your credentials

From Project Settings → **API**, copy:
- **Project URL** (e.g. `https://abcxyz.supabase.co`)
- **anon / public** key (a long JWT — safe to expose in frontend)

Paste them into `.env.local`:

```env
VITE_SUPABASE_URL=https://abcxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

## 3. Run the SQL

Open the **SQL Editor** in your Supabase dashboard and run each file in order:

| File | What it creates |
|---|---|
| `supabase/01-schema.sql` | Tables, indexes, triggers |
| `supabase/02-policies.sql` | Row-level security policies |
| `supabase/03-seed.sql` | 4 contractors + 17 real Orange NSW defects |
| `supabase/04-link-users.sql` | Promotes demo signups to admin/contractor |
| `supabase/05-followers.sql` | "Follow updates" table + RLS (powers the Follow button on a defect) |
| `supabase/06-storage.sql` | `defect-photos` storage bucket + policies (powers real photo upload in the Report flow) |

Run `05` and `06` even on a project that already ran `01`–`04` — they're additive and only needed once.

### Linking a contractor account to a contractor company

The `/contractor` page shows nothing until a contractor's `profiles.contractor_id` points at a row in
`contractors`. For real (non-demo) contractor sign-ups, an admin needs to run, once per contractor user:

```sql
update public.profiles set contractor_id = '<contractor uuid from the contractors table>'
 where email = 'the-contractor@example.com';
```

## 4. Disable email confirmation (for the demo)

**Authentication → Providers → Email → Confirm email → OFF**

This lets your demo users sign in without an email round-trip.

## 5. Create the demo accounts

**Authentication → Users → Add user** (create three):

| Email | Password | Purpose |
|---|---|---|
| `citizen@example.com` | `demo1234` | Citizen flow |
| `contractor@example.com` | `demo1234` | Contractor kanban |
| `admin@example.com` | `demo1234` | Admin dashboard |

Then run `04-link-users.sql` once — it promotes their profiles to the right roles.

## 6. Try it

Restart `npm run dev` and sign in with any of the three accounts.

## 7. What's real vs. what needs another service

Everything in this app writes to and reads from real Postgres tables once the SQL above has run — there
is no fabricated data once `.env.local` is set. Two features are intentionally left as manual follow-ups
because they need a *third-party* service this repo can't provision for you:

- **Emailing followers when a defect changes status.** The "Follow updates" button persists a real
  follow relationship in `public.followers`, but actually sending an email needs a Supabase Edge
  Function wired to a transactional email provider (Resend, Postmark, SES, …) triggered off
  `repair_updates` inserts, plus that provider's API key. Not included here.
- **Production admin/contractor onboarding.** Anyone can self-register as a citizen or contractor from
  `/register`. Promoting a user to `admin`, or linking a contractor sign-up to a `contractors` row, is a
  deliberate one-line SQL update (see above) rather than a self-serve flow — that's a safety choice, not
  a missing feature.

## 8. Creating a council (admin) account

There's no "register as admin" option in the app on purpose — anyone could tick it otherwise. Two ways
to create one, pick whichever is easier:

**A — via the app, then promote (works either way, with or without email confirmation on):**
1. Go to `/register`, sign up normally as a citizen with the council staff member's real email.
2. In Supabase Dashboard → **SQL Editor**, run:
   ```sql
   update public.profiles
      set role = 'admin'
    where email = 'the-real-council-email@example.com';
   ```
3. Sign out and back in (or just refresh) — `/admin` is now available to that account.

**B — create it directly in the dashboard (skips email confirmation entirely):**
1. Supabase Dashboard → **Authentication → Users → Add user**. Set an email + password; this
   creates the account as already-confirmed, so it can sign in immediately either way.
2. This fires the same `handle_new_user` trigger as a normal sign-up, creating a `profiles` row
   with `role = 'citizen'` by default. Promote it with the same SQL as above.

You can have as many admin accounts as council needs — just repeat step 2/the SQL for each staff
email. There's intentionally no UI for this so a compromised citizen or contractor account can never
grant itself admin access.
