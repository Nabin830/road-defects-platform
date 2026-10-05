# What we built — RoadFix

RoadFix is a web app (also installable on a phone) for reporting road defects and following each repair
from report to a council-verified fix. This file lists everything that has been implemented, by role and by
area, and what has been tested.

**Live site:** https://roadfix-nabin-pandeys-projects.vercel.app
**Code:** https://github.com/Nabin830/road-defects-platform (branch `main`)
**Built:** 23 Sep – 5 Oct 2026 · Nabin Pandey · PRT631 Information Systems Practicum, Charles Darwin University

---

## 1. The idea in one picture

```
Resident reports ──► Council triages ──► Contractor fixes ──► Council verifies ──► Closed
  (photo + GPS)      (assign, work order,   (accept, progress     (or sends back      (resident can say
                      fix-by date)           photos, complete)     for rework)          "not fixed" for 7 days)
```

Every step is logged on a public timeline, and everyone involved is notified in the app (bell) and,
if they turn it on, on their phone.

---

## 2. Residents

| Feature | Details |
| --- | --- |
| **Report a defect** | 3 steps: location → details (type, severity, title, description) → photo. About 60 seconds. |
| **Location** | On a phone: GPS only (can't be typed or dragged), must be accurate to 100 m. On a computer: address search, tap the map, or "Use my location". Street address looked up automatically. |
| **Live camera photo** | On a phone the photo must be taken live (no gallery). Date, time, GPS and address are stamped on the photo. It must be taken within 150 m of the reported spot. Computers can also upload a file, which is clearly marked as an upload. |
| **Duplicate warning** | Open reports within 150 m are shown, so people back an existing report instead of making a new one. A new report within 150 m of one from the last hour is blocked. |
| **Back a report** | "Back this report" raises its priority (can't back your own). |
| **Follow a report** | Get notified about every update on it. |
| **Dashboard and My reports** | Own reports with status, counts, and the latest defects on a map. |
| **Report offline** | With no signal the report (and photo) is saved on the phone and sent automatically when the connection is back. See section 6. |
| **Phone notifications** | Turn on under Profile & settings. On iPhone, add RoadFix to the home screen first. |
| **"Not fixed? Tell council"** | Up to 7 days after council verifies a repair, the reporter or anyone who backed it can say it isn't fixed, with a photo. Council then reopens it or closes the request with a reason. |
| **Privacy** | Name and address are never shown publicly. A tip reminds people to keep faces and number plates out of photos. |

## 3. Council

| Feature | Details |
| --- | --- |
| **Overview** | Totals, pending, overdue, awaiting sign-off; charts by status and severity; map of every defect; CSV export (safe against spreadsheet formula tricks). |
| **Triage list in priority order** | New reports sorted by a score with the reasons shown (severity, backing, days waiting, overdue / due soon, "resident says not fixed"). |
| **Bulk actions** | Tick several reports, then **Assign** them all to a contractor with one work order, or **Reject** them all with one reason. |
| **Assign with a work order** | What to do, which contractor, and a fix-by date (or the standard target for the severity). |
| **Re-grade severity** | Logged on the timeline. |
| **Verify or send back** | Check the contractor's before/after photos, then close the job or send it back for rework with a note. |
| **Reject** | With a reason the reporter can see. |
| **Merge duplicates** | Pick the original from nearby open reports (or type its ID). The duplicate closes with a link; its backing and followers — and its reporter — move to the original. |
| **Hide a photo from the public** | For faces, number plates or private property. Only council and the reporter can still see it. Can be shown again. |
| **"Residents say these aren't fixed"** | List of verified repairs a resident has challenged, with **Reopen for rework** or **Repair is fine**. |
| **Photo checks** | For every photo: live camera or upload, time, GPS accuracy, and warnings — uploaded, no GPS, weak GPS, far from the spot, clock mismatch, same photo used on another report, sent offline. |
| **Reports page** | Reports received vs verified, what's being reported, median days to fix, and a contractor scorecard: open jobs, overdue, verified, on time, median turnaround, sent back, declined. |
| **People page** | Change anyone's role (resident / contractor / council), link contractors to companies, add and rename companies. The last council admin can't be removed. |
| **Deadline alerts** | Overdue and due-within-24-hours jobs are highlighted. |

## 4. Contractors

| Feature | Details |
| --- | --- |
| **My jobs** | Assigned, In progress and Completed columns, with work orders, deadlines and "needs your response". |
| **Accept or decline** | Declining sends the job back to council with a reason. |
| **Progress updates** | Note, progress %, and a required site photo. |
| **Mark complete** | Required "after" photo. The resident's **before** photo is shown so the after photo can match the angle. |
| **Nearest first + Navigate** | Sort jobs by distance from where the crew is, and open turn-by-turn directions in Google Maps. |
| **Work offline** | Accept, start, progress photos and completion are saved on the phone and sent in order when the signal returns. Jobs and job pages still show from the last saved copy. |
| **Company name** | Can rename their own company (what council sees). |

## 5. Everyone

- Public map and list of every report with filters (status, severity, type, search) and map / cards / table views.
- Public report page: photo, details, location map, deadline, before & after photos, and the full repair timeline.
- Notification bell with live updates; light and dark mode; works on phones (bottom tab bar) and computers.
- Privacy policy and terms pages; "Emergencies: call 000" in the footer.
- Fast loading: pages load on demand, self-hosted fonts, per-page titles and descriptions for search engines,
  sitemap and robots.txt (sitemap needs `VITE_SITE_URL` set).

---

## 6. Offline mode (installable app)

- The site is a **PWA**: after one visit it opens with no signal, and can be added to the home screen.
- **Outbox:** reports and contractor job steps made offline are kept on the phone (photo included) and sent
  automatically when the connection returns — in order, one report a minute (the spam limit), with a
  "Saved on this phone" list and a bar at the top showing what's waiting.
- Each report gets its ID when it's saved, so a report sent twice is never stored twice.
- People stay signed in on their device while offline (it only affects the screen; the server still checks
  the real sign-in before accepting anything).
- If something saved offline is refused when it's sent (for example a duplicate), it stays on the phone with
  the reason, and can be retried or deleted.

## 7. Notifications

- **In the app:** the bell. Created automatically for the reporter, followers, the assigned contractor's
  accounts and council — never for the person who did the action.
- **On the phone (web push):** sent by the `push` Edge Function on Supabase. It only sends real notifications
  that haven't been sent yet, each once; only signed-in users can wake it, and nobody can call the part that
  picks what to send. Tapping a notification opens the report. Signing out turns notifications off on that
  device, so the next person doesn't get them.

## 8. Security — rules the database enforces

Every rule below is enforced by the database itself (row-level security and triggers), so it holds even
for someone who skips the website and calls the API directly.

**Reports**
- Must be signed in; a photo is required; title and description must be real words within length limits.
- Only inside the service area — currently **all of Australia** (can be switched to Orange City Council only).
- New reports always start clean: pending, 0 backing, no contractor — faked values are reset.
- Spam limits: 1 report a minute, 10 a day; no new report within 150 m of an open one from the last hour.

**Photos**
- A photo link must be a file the poster really uploaded, into their own folder of the RoadFix photo bucket
  (no borrowing someone else's photo, no fake links, no `../` tricks).
- The website only shows photos from the project's own bucket (no pictures from other websites).
- Photos saved offline must be live camera photos with GPS, sent within 3 days, and can't be dated in the
  future or before the account was created. They are always flagged "offline" for council.
- Residents can't remove the "offline" mark or the photo warnings.

**Roles and workflow**
- Stage order: pending → assigned → in progress → completed → verified. No skipping.
- Residents can only edit their own report while it's pending; contractors can only move their own
  company's jobs along; only council can verify, set work orders and deadlines, hide photos and merge.
- Timeline entries must be posted as the person's real role ("council" entries can't be faked).
- Verified repairs are locked. Fair backing (not your own report, not closed reports). Contractors' timeline
  posts are rate-limited. Text length limits everywhere.

**Accounts**
- Council accounts are only granted in the database, never by sign-up.
- Optional "I'm not a robot" check (Cloudflare Turnstile) on sign-up and sign-in, enforced by Supabase.

---

## 9. Technology

| Part | Used |
| --- | --- |
| Website | React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 7, Zustand |
| Maps | Leaflet + OpenStreetMap; addresses from Nominatim (optional caching Edge Function `geocode`) |
| Database, sign-in, photos | Supabase (Postgres, Auth, Storage, Realtime) |
| Server code | Supabase Edge Functions (Deno): `geocode`, `push` |
| Offline | `vite-plugin-pwa` (service worker), IndexedDB outbox |
| Hosting | Vercel (builds from `main` on every push) |
| Quality | TypeScript strict, ESLint (type-checked rules) |

**Key files**

| File | What it is |
| --- | --- |
| `supabase/Database.sql` | The one file that builds the whole database (wipes everything first). |
| `supabase/Council-Account.sql` | Re-creates the `council@gmail.com` admin with a new password. |
| `supabase/functions/push/` | Phone notification sender. |
| `src/lib/outbox.ts` | Offline outbox (reports and contractor steps). |
| `src/lib/api.ts` | Everything the website asks the database to do. |
| `public/push-sw.js` | Shows phone notifications. |
| `docs/` | Setup, Supabase, deployment, troubleshooting, and this file. |

---

## 10. What has been tested

- **Database rules on a local copy:** 40+ checks — every cheating attempt blocked, every real flow allowed,
  `Database.sql` runs twice in a row without errors.
- **Live system (real Supabase, test accounts, then cleaned up):** 52 checks including the full job flow,
  offline report and offline contractor photo, merge, hide photo, "not fixed" → reopen, notifications and
  the anti-cheating rules.
- **Live website in Chrome:** home, map, sign in, council overview, reports, people, profile and report pages
  load with no errors; the offline app and notification key are in place.
- **Whole-app code review:** 4 bugs found and fixed (sign-out freeze without a service worker, crash after a
  new release, missed council notification after a lost reply, error shown on the dashboard offline).
- Type check, lint and production build pass.

**Still to test on a real phone:** camera and GPS, airplane-mode reporting, and a phone notification arriving.

## 11. Setup status and limits

| Item | Status |
| --- | --- |
| Database (`Database.sql`) | Done |
| Live site public on Vercel | Done |
| Phone notifications (`push` function + keys) | Done |
| Service area | All of Australia (for now) |
| Robot check (Turnstile) | Optional — not set up yet |
| `VITE_SITE_URL` (sitemap for Google) | Recommended — not set yet |
| Database backups | Not set up (free Supabase plan has none; it also pauses after ~7 days without use) |

**Limits to know**
- A resident must sign in once with internet on a phone before reporting offline.
- On iPhone, saved reports send only while RoadFix is open, and notifications need the home-screen app.
- The map is blank offline (GPS still works).
- Someone who rewrites the app on their own device can still invent GPS, times and photo fingerprints — that's
  why council sees how every photo was taken and verifies every repair.
