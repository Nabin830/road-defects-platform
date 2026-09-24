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

Open the **SQL Editor** in your Supabase dashboard, paste the whole of
`supabase/00-all-in-one.sql` and click **Run**. That one file:

- **wipes** every previous table, function and policy in the `public` schema (and the old
  `@example.com` demo accounts) — this deletes all existing data, there is no undo
- creates the tables, indexes, triggers and row-level security policies
- creates the `followers` table and the `defect-photos` storage bucket
- recreates profiles for existing accounts and makes `council@gmail.com` an admin

No dummy data is inserted — contractors and defects start empty and are created from the app.
Uploaded photo files are not removed by SQL; clear them in **Storage → defect-photos** if needed.

### Contractor accounts

When someone registers at `/register` choosing **"I'm a contractor"**, a row in `contractors` is
created for them automatically and linked to their profile, so council can assign work to them
immediately. Assigned jobs show **Accept job / Decline job** to the contractor; declining sends the
defect back to council as unassigned (`pending`). When the contractor marks a job complete it
shows as **Awaiting sign-off** until council clicks **Verify & close** (or **Send back for rework**);
verified jobs are locked. Nobody can self-register as admin — grant it by SQL.

### Notifications

Every timeline update creates in-app notifications (the bell in the header) for the people involved:
the reporter, anyone following the defect, the assigned contractor, and council (for resident and
contractor actions). The person who made the update is never notified about their own action. The
bell updates live through Supabase Realtime (the SQL adds `notifications` to the `supabase_realtime`
publication) and also refreshes every minute.

Note: the app uses hash URLs — e.g. `http://localhost:5173/#/login`, `#/admin`.

### Password reset

"Forgot password?" on the sign-in page emails a reset link. For the link to be accepted, add your app's
address under **Authentication → URL Configuration → Redirect URLs**, e.g. `http://localhost:5173/**`
(and your production URL when deployed). The link must be opened in the same browser that requested it.

### Council pages

- **People** (`#/admin/people`): change anyone's role (resident / contractor / council), link contractor
  accounts to a company, and add or rename contractor companies. There is always at least one council
  admin — the last one can't be demoted. Profiles (emails, phones) are visible only to their owner and council.
- **Reports** (`#/admin/reports`): reports received vs repairs verified per month, median time to fix and to
  assign, the share fixed within deadline, reports by type, and contractor performance — for the last 3, 6 or
  12 months.

### Other built-in rules

- **Deadlines**: each open defect has a due date from its severity — critical 1 day, high 3–5 days
  (overdue after 5), medium 7 days, low 10 days, counting every day including weekends — shown as
  "Due in…" / "Overdue by…". Council can change severity, and can set its own "days to fix" when assigning.
- **Repair photos**: contractors can attach a photo when posting an update or marking a job complete;
  it appears on the timeline for council to check before verifying.
- **Duplicates**: when reporting, open reports within 150 m of the pin are shown so residents can back
  an existing report instead of filing a new one.

## 4. Disable email confirmation (for the demo)

**Authentication → Providers → Email → Confirm email → OFF**

This lets your demo users sign in without an email round-trip.

## 5. Create the admin account

Sign up `council@gmail.com` in the app (or **Authentication → Users → Add user**), then re-run
`supabase/00-all-in-one.sql` — or just this line — to make it an admin:

```sql
update public.profiles set role = 'admin' where lower(email) = 'council@gmail.com';
```

Log out and back in after changing a role.

## 6. Try it

Restart `npm run dev` and sign in as `council@gmail.com`.

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
