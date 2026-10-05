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

Pages use normal addresses — e.g. `http://localhost:5173/login`, `/admin`. Old `/#/…` links still work (they redirect).

### Passwords (no emails)

RoadFix doesn't send any emails. People change their own password on the Profile page. If someone
forgets theirs, council sets a temporary one in the SQL Editor (the dashboard's own "recovery" option
sends an email, so don't use it):

```sql
update auth.users set encrypted_password = extensions.crypt('NewTempPassword123', extensions.gen_salt('bf'))
 where lower(email) = 'person@example.com';
```

Then tell the person their temporary password in person or by phone, and ask them to change it on the Profile page.

### Council pages

- **People** (`/admin/people`): change anyone's role (resident / contractor / council), link contractor
  accounts to a company, and add or rename contractor companies. There is always at least one council
  admin — the last one can't be demoted. Profiles (emails, phones) are visible only to their owner and council.
- **Reports** (`/admin/reports`): reports received vs repairs verified per month, median time to fix and to
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

### Updating a database that already has data

`00-all-in-one.sql` wipes everything. To upgrade an existing database instead, run these in the SQL
Editor, in order, skipping any you've already run. Each keeps your data:

| File | What it adds |
| --- | --- |
| `01-work-orders.sql` | Work orders and council-set fix-by dates |
| `02-upgrades.sql` | Spam limits and the address lookup cache |
| `03-fix-length-check.sql` | Lets older short reports be updated again |
| `04-workflow-rules.sql` | Required photos, stage order, duplicate blocking |
| `05-anti-tamper.sql` | Stops people bypassing the website to fake data (see below) |
| `06-hardening.sql` | Text limits, fair backing, timeline flood limit, company edits, notification clean-up |
| `07-search-path.sql` | Pins every function's `search_path` (clears Supabase's "Function Search Path Mutable" warning) |
| `08-photo-checks.sql` | Saves how each photo was taken (live camera or upload, time, GPS) and flags reused, far-away or weak-GPS photos for council |

**Why 05 matters:** anyone can send requests straight to the database without using the website.
05 makes the database enforce what each role may change: new reports always start clean and inside
the council area, residents only edit their own pending report's wording/photo/location, contractors
only move their own jobs along, timeline entries must match the poster's real role, photo links must
point at the RoadFix photo bucket, and votes stay private.

## 4. Turn off email confirmation (required)

**Authentication → Providers → Email → Confirm email → OFF**

RoadFix doesn't send emails, so new accounts must be able to sign in straight away. If this is left on,
sign-up shows an error asking council to turn it off.

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
is no fabricated data once `.env.local` is set. RoadFix sends no emails: followers are notified inside
the app only (the bell icon). One thing is intentionally manual:

- **Production admin/contractor onboarding.** Anyone can self-register as a citizen or contractor from
  `/register`. Promoting a user to `admin`, or linking a contractor sign-up to a `contractors` row, is a
  deliberate one-line SQL update (see above) rather than a self-serve flow — that's a safety choice, not
  a missing feature.

## 8. Creating a council (admin) account

There's no "register as admin" option in the app on purpose — anyone could tick it otherwise. Two ways
to create one, pick whichever is easier:

**A — via the app, then promote:**
1. Go to `/register`, sign up normally as a citizen with the council staff member's real email.
2. In Supabase Dashboard → **SQL Editor**, run:
   ```sql
   update public.profiles
      set role = 'admin'
    where email = 'the-real-council-email@example.com';
   ```
3. Sign out and back in (or just refresh) — `/admin` is now available to that account.

**B — create it directly in the dashboard:**
1. Supabase Dashboard → **Authentication → Users → Add user**. Set an email + password; this
   creates the account as already-confirmed, so it can sign in immediately either way.
2. This fires the same `handle_new_user` trigger as a normal sign-up, creating a `profiles` row
   with `role = 'citizen'` by default. Promote it with the same SQL as above.

You can have as many admin accounts as council needs — just repeat step 2/the SQL for each staff
email. There's intentionally no UI for this so a compromised citizen or contractor account can never
grant itself admin access.
