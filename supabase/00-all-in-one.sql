-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Assessment Platform — ALL-IN-ONE Supabase Setup
--
-- Paste this whole file into Supabase SQL Editor and click "Run".
--
-- It does everything, in order:
--   STEP 0. WIPE      — deletes ALL previous tables, data, functions,
--                       triggers and policies in the public schema
--   STEP 1. SCHEMA    — tables, indexes, triggers
--   STEP 2. POLICIES  — row level security
--   STEP 3. FOLLOWERS — "follow updates" table
--   STEP 4. STORAGE   — defect-photos bucket + policies
--   STEP 5. SEED      — contractors, 17 defects, repair updates
--   STEP 6. USERS     — re-creates profiles for existing auth users and
--                       links the demo accounts (safe if they don't exist)
--
-- ⚠️  STEP 0 IS DESTRUCTIVE. Every table in the public schema and all
--     of its data is permanently deleted. There is no undo.
--
-- This file replaces running 01 → 06 one by one.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- STEP 0. WIPE EVERYTHING FROM PREVIOUS SETUPS
-- ═══════════════════════════════════════════════════════════════════

-- Trigger on auth.users that auto-creates profiles
drop trigger if exists on_auth_user_created on auth.users;

-- Storage policies for the photo bucket
drop policy if exists "defect-photos: public read"          on storage.objects;
drop policy if exists "defect-photos: authenticated upload" on storage.objects;
drop policy if exists "defect-photos: owner delete"         on storage.objects;

-- Drop every view, table and function in the public schema
-- (skips anything owned by a Postgres extension)
do $$
declare
  r record;
begin
  -- views
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v','m')
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('drop view if exists public.%I cascade', r.relname);
  end loop;

  -- tables (cascade removes their data, indexes, triggers and policies)
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p')
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;

  -- functions
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f','p')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- Optional: also delete every user account (Authentication → Users).
-- Uncomment ONLY if you want all users gone and plan to sign up again.
-- delete from auth.users;

-- Note: uploaded photo FILES can't be deleted with SQL on Supabase.
-- To remove them: Dashboard → Storage → defect-photos → select all → Delete.


-- ═══════════════════════════════════════════════════════════════════
-- STEP 1. SCHEMA
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends auth.users) ────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  name          text not null,
  role          text not null default 'citizen' check (role in ('citizen','contractor','admin')),
  phone         text,
  suburb        text,
  contractor_id uuid,             -- populated for contractor accounts
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── CONTRACTORS ──────────────────────────────────────────────────
create table public.contractors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  abbr       text not null,
  crew_size  int  not null default 4,
  rating     numeric(2,1) default 4.5,
  created_at timestamptz not null default now()
);

-- ─── DEFECTS ──────────────────────────────────────────────────────
create table public.defects (
  id             text primary key,                    -- e.g. RD-2041
  title          text not null,
  description    text not null,
  defect_type    text not null
                 check (defect_type in ('pothole','crack','edge','flooding','marking','signage','debris','subside')),
  severity       text not null check (severity in ('low','medium','high','critical')),
  status         text not null default 'pending'
                 check (status in ('pending','assigned','progress','completed','rejected')),
  road           text not null,
  suburb         text,
  latitude       numeric(10,7) not null,
  longitude      numeric(10,7) not null,
  depth          text,
  width          text,
  photo_url      text,
  votes          int not null default 0,
  progress       int not null default 0 check (progress between 0 and 100),
  reject_reason  text,
  reported_by    uuid references public.profiles(id) on delete set null,
  contractor_id  uuid references public.contractors(id) on delete set null,
  reported_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── REPAIR UPDATES (audit trail) ─────────────────────────────────
create table public.repair_updates (
  id            uuid primary key default gen_random_uuid(),
  defect_id     text not null references public.defects(id) on delete cascade,
  action        text not null,                        -- Report submitted, Triaged, Assigned, etc.
  note          text,
  progress      int check (progress between 0 and 100),
  photo_url     text,
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_role    text,                                 -- citizen/contractor/admin (snapshot)
  created_at    timestamptz not null default now()
);

-- ─── VOTES (residents upvote existing defects) ────────────────────
create table public.votes (
  defect_id  text not null references public.defects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (defect_id, user_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────
create index idx_defects_status         on public.defects(status);
create index idx_defects_severity       on public.defects(severity);
create index idx_defects_reported_by    on public.defects(reported_by);
create index idx_defects_contractor_id  on public.defects(contractor_id);
create index idx_defects_reported_at    on public.defects(reported_at desc);
create index idx_updates_defect_id      on public.repair_updates(defect_id, created_at desc);
create index idx_profiles_role          on public.profiles(role);

-- ─── AUTO-UPDATE timestamps ───────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger trg_defects_touch before update on public.defects
  for each row execute function public.touch_updated_at();

-- ─── AUTO-CREATE profile on signup ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role, suburb)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'citizen'),
    new.raw_user_meta_data->>'suburb'
  )
  on conflict (id) do nothing;
  return new;
end $$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── VOTE COUNTER (keeps defects.votes in sync) ───────────────────
create or replace function public.recount_votes()
returns trigger as $$
begin
  update public.defects
     set votes = (select count(*) from public.votes where defect_id = coalesce(new.defect_id, old.defect_id))
   where id = coalesce(new.defect_id, old.defect_id);
  return null;
end $$ language plpgsql;

create trigger trg_votes_recount after insert or delete on public.votes
  for each row execute function public.recount_votes();


-- ═══════════════════════════════════════════════════════════════════
-- STEP 2. ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.contractors    enable row level security;
alter table public.defects        enable row level security;
alter table public.repair_updates enable row level security;
alter table public.votes          enable row level security;

-- ─── Helpers ──────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

create or replace function public.is_contractor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contractor'
  );
$$ language sql stable security definer;

create or replace function public.my_contractor_id()
returns uuid as $$
  select contractor_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ─── PROFILES ─────────────────────────────────────────────────────
create policy "Profiles: anyone signed-in can read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Profiles: users update their own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
  -- prevents a user from changing their own role

create policy "Profiles: admins update anyone"
  on public.profiles for update
  using (public.is_admin());

-- ─── CONTRACTORS ──────────────────────────────────────────────────
create policy "Contractors: everyone can read"
  on public.contractors for select using (true);

create policy "Contractors: admins can write"
  on public.contractors for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─── DEFECTS ──────────────────────────────────────────────────────
create policy "Defects: everyone can read"
  on public.defects for select using (true);

create policy "Defects: authenticated users can create"
  on public.defects for insert
  with check (auth.uid() = reported_by);

create policy "Defects: reporter can edit while pending"
  on public.defects for update
  using (auth.uid() = reported_by and status = 'pending')
  with check (auth.uid() = reported_by);

create policy "Defects: contractors update assigned work"
  on public.defects for update
  using (public.is_contractor() and contractor_id = public.my_contractor_id());

create policy "Defects: admins can do anything"
  on public.defects for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─── REPAIR UPDATES ───────────────────────────────────────────────
create policy "Updates: everyone can read"
  on public.repair_updates for select using (true);

create policy "Updates: signed-in can insert"
  on public.repair_updates for insert
  with check (auth.uid() = actor_id);

create policy "Updates: admins can delete"
  on public.repair_updates for delete
  using (public.is_admin());

-- ─── VOTES ────────────────────────────────────────────────────────
create policy "Votes: everyone can read"
  on public.votes for select using (true);

create policy "Votes: users manage their own"
  on public.votes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- STEP 3. FOLLOWERS ("Follow updates")
-- ═══════════════════════════════════════════════════════════════════

create table public.followers (
  defect_id  text not null references public.defects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (defect_id, user_id)
);

create index idx_followers_user on public.followers(user_id);

alter table public.followers enable row level security;

create policy "Followers: users manage their own"
  on public.followers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- STEP 4. PHOTO STORAGE
-- ═══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('defect-photos', 'defect-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Anyone can view photos (they're shown on the public defect map)
create policy "defect-photos: public read"
  on storage.objects for select
  using (bucket_id = 'defect-photos');

-- Signed-in users upload into their own folder (path prefix = their user id)
create policy "defect-photos: authenticated upload"
  on storage.objects for insert
  with check (
    bucket_id = 'defect-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can delete their own uploads
create policy "defect-photos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'defect-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ═══════════════════════════════════════════════════════════════════
-- STEP 5. SEED DATA
-- ═══════════════════════════════════════════════════════════════════

-- ─── CONTRACTORS ──────────────────────────────────────────────────
insert into public.contractors (id, name, abbr, crew_size, rating) values
  ('11111111-1111-1111-1111-111111111111', 'Central West Road Services', 'CW', 6, 4.8),
  ('22222222-2222-2222-2222-222222222222', 'Cabonne Civil',              'CC', 4, 4.4),
  ('33333333-3333-3333-3333-333333333333', 'Summit Asphalt',             'SA', 8, 4.9),
  ('44444444-4444-4444-4444-444444444444', 'Orange City Works Crew',     'OW', 5, 4.2);

-- ─── DEFECTS ──────────────────────────────────────────────────────
insert into public.defects (id, title, description, defect_type, severity, status, road, suburb, latitude, longitude, depth, width, votes, progress, contractor_id, reported_at) values
  ('RD-2041','Deep pothole in eastbound lane','Large pothole has opened in the eastbound lane approaching the Anson St lights. Water pooling in it after Tuesday rain. Two cars ahead of me hit it hard. Vehicle damage risk — this is on a bus route.','pothole','critical','progress','Summer St at Anson St','Orange',-33.28362,149.09902,'180 mm','0.9 m',23,60,'33333333-3333-3333-3333-333333333333', now() - interval '2 days'),
  ('RD-2038','Sealed edge collapsing on shoulder','Bitumen edge has broken away along a 22 metre stretch on the southern shoulder. Heavy truck traffic is widening it daily.','edge','high','assigned','Mitchell Hwy, 1.4 km W of Lucknow','Lucknow',-33.31290,149.16240,'90 mm','0.4 m × 22 m',11,0,'11111111-1111-1111-1111-111111111111', now() - interval '4 days'),
  ('RD-2033','Stormwater pooling across both lanes','The grate is blocked with leaf litter so runoff crosses the full carriageway after any decent rain. Visibility of the kerb line is gone at night.','flooding','high','pending','Ophir St near Warrendine St','Orange',-33.27698,149.09612,'—','12 m',17,0,null, now() - interval '1 day'),
  ('RD-2029','Longitudinal cracking, 40 m section','Series of parallel cracks running with the direction of travel. Widening since winter.','crack','medium','completed','Byng St near Lords Place','Orange',-33.28118,149.10140,'25 mm','40 m',6,100,'33333333-3333-3333-3333-333333333333', now() - interval '21 days'),
  ('RD-2026','Pothole cluster outside primary school','Three potholes in the drop-off zone. Parents are swerving into the opposing lane to avoid them at pickup time.','pothole','critical','assigned','McLachlan St at Kite St','Orange',-33.28902,149.09338,'140 mm','3 potholes',38,0,'11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('RD-2024','Give way sign knocked flat','Sign post sheared at the base, likely struck overnight. Intersection currently uncontrolled.','signage','critical','completed','Bathurst Rd at Hill St','Orange',-33.29470,149.11180,'—','—',14,100,'44444444-4444-4444-4444-444444444444', now() - interval '9 days'),
  ('RD-2021','Centre line completely worn away','Line marking is invisible in wet conditions along the whole stretch past the showground turnoff.','marking','medium','progress','Molong Rd, Orange to Borenore','Orange',-33.26830,149.07420,'—','2.1 km',9,35,'22222222-2222-2222-2222-222222222222', now() - interval '12 days'),
  ('RD-2018','Shallow pothole near roundabout','Minor surface loss on the approach to the roundabout.','pothole','low','completed','Peisley St at Kite St','Orange',-33.28770,149.10480,'40 mm','0.3 m',3,100,'33333333-3333-3333-3333-333333333333', now() - interval '27 days'),
  ('RD-2015','Pavement subsidence over trench','Old service trench has settled. Noticeable dip that bottoms out low vehicles.','subside','high','progress','Icely Rd near Coronation Dr','Orange',-33.29510,149.08130,'110 mm dip','6 m',12,80,'33333333-3333-3333-3333-333333333333', now() - interval '8 days'),
  ('RD-2012','Fallen branch blocking bike lane','Large gum branch down across the marked bike lane after Thursday winds.','debris','medium','completed','Forest Rd near Emmaville Ln','Orange',-33.27040,149.10810,'—','—',5,100,'44444444-4444-4444-4444-444444444444', now() - interval '15 days'),
  ('RD-2009','Crocodile cracking, full lane width','Interconnected cracking pattern suggesting base failure rather than a surface issue.','crack','high','assigned','Clergate Rd, 600 m N of Northern Distributor','Orange',-33.25310,149.09010,'30 mm','18 m',8,0,'11111111-1111-1111-1111-111111111111', now() - interval '6 days'),
  ('RD-2006','Drain grate sitting 60 mm proud','Grate has lifted above the road surface. Hazard for cyclists using the kerb lane.','flooding','medium','pending','Lords Place at Summer St','Orange',-33.28558,149.10270,'60 mm','0.6 m',4,0,null, now() - interval '1 day'),
  ('RD-2001','Pothole on heritage streetscape','Pothole outside the bakery. High pedestrian and tourist traffic on weekends.','pothole','medium','assigned','Pym St, Millthorpe','Millthorpe',-33.44520,149.19320,'75 mm','0.5 m',19,0,'22222222-2222-2222-2222-222222222222', now() - interval '5 days'),
  ('RD-1998','Washout after culvert overflow','Creek overtopped the culvert and scoured out the downstream shoulder. One lane effectively unusable.','flooding','critical','progress','Cargo Rd near Borenore Ck','Borenore',-33.27620,148.94510,'300 mm scour','4 m',16,25,'11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('RD-1995','Worn pedestrian crossing markings','Zebra stripes are about half worn through outside the medical centre.','marking','low','pending','March St at Sale St','Orange',-33.27912,149.09960,'—','—',7,0,null, now() - interval '2 days'),
  ('RD-1992','Gravel spill across intersection','Truck lost load of road base. Slippery for motorcycles.','debris','high','completed','Adelaide St, Blayney','Blayney',-33.53310,149.25340,'—','—',6,100,'22222222-2222-2222-2222-222222222222', now() - interval '11 days'),
  ('RD-1989','Sunken manhole in wheel path','Manhole cover sits well below the resurfaced pavement.','subside','medium','assigned','Woodward St near Summer St','Orange',-33.28812,149.10010,'50 mm','0.7 m',5,0,'44444444-4444-4444-4444-444444444444', now() - interval '7 days');

-- ─── REPAIR UPDATES ───────────────────────────────────────────────
insert into public.repair_updates (defect_id, action, note, progress, actor_role, created_at) values
  ('RD-2041','Report submitted','Photo and location captured on Summer St, eastbound lane.',0,'citizen', now() - interval '2 days'),
  ('RD-2041','Triaged as Critical','Bus route and vehicle damage risk. 24 hour SLA applied. Temporary cold-mix authorised.',0,'admin', now() - interval '2 days'),
  ('RD-2041','Assigned to crew','Crew 2 scheduled for the 6am window to avoid peak traffic. Traffic control booked.',10,'contractor', now() - interval '1 day'),
  ('RD-2041','Cold-mix patch placed','Interim patch down and compacted. Hazard removed. Permanent hot-mix repair scheduled Thursday once the saw cut is done.',60,'contractor', now() - interval '19 hours'),
  ('RD-2029','Report submitted','Cracking along Byng St.',0,'citizen', now() - interval '21 days'),
  ('RD-2029','Triaged as Medium','Scheduled into the crack-sealing program.',0,'admin', now() - interval '19 days'),
  ('RD-2029','Assigned','Bundled with three nearby jobs.',15,'contractor', now() - interval '14 days'),
  ('RD-2029','Crack sealing underway','Routed and sealed 28 of 40 metres.',65,'contractor', now() - interval '9 days'),
  ('RD-2029','Repair complete','Full 40 m sealed and swept. Site cleared.',100,'contractor', now() - interval '6 days'),
  ('RD-2029','Inspected and closed','Passed post-works inspection. Defect closed.',100,'admin', now() - interval '5 days');


-- ═══════════════════════════════════════════════════════════════════
-- STEP 6. USERS
-- ═══════════════════════════════════════════════════════════════════

-- Re-create a profile for every account that already exists in
-- Authentication (the wipe in STEP 0 deleted the old profiles table).
insert into public.profiles (id, email, name, role, suburb)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       coalesce(u.raw_user_meta_data->>'role', 'citizen'),
       u.raw_user_meta_data->>'suburb'
  from auth.users u
 where u.email is not null
on conflict (id) do nothing;

-- Link demo accounts to their roles. Does nothing if these accounts
-- haven't been signed up yet — sign them up in the app, then re-run
-- just this STEP 6 section.
--   citizen@example.com / contractor@example.com / admin@example.com  (password: demo1234)
update public.profiles
   set role = 'admin', name = 'Helen Osei', suburb = 'Orange City Council'
 where email = 'admin@example.com';

update public.profiles
   set role = 'contractor',
       name = 'Dev Raghunath',
       suburb = 'Summit Asphalt',
       contractor_id = '33333333-3333-3333-3333-333333333333'
 where email = 'contractor@example.com';

update public.profiles
   set role = 'citizen', name = 'Alicia Moreau', suburb = 'Orange NSW 2800'
 where email = 'citizen@example.com';

-- Give the citizen some reports so "My reports" has data
update public.defects
   set reported_by = (select id from public.profiles where email = 'citizen@example.com')
 where id in ('RD-2041','RD-2033','RD-2029','RD-2021','RD-2018','RD-2012','RD-2006','RD-1995','RD-1989');

-- ─── Confirm ──────────────────────────────────────────────────────
select 'contractors'    as "table", count(*) as rows from public.contractors
union all select 'defects',        count(*) from public.defects
union all select 'repair_updates', count(*) from public.repair_updates
union all select 'profiles',       count(*) from public.profiles;

-- ═══════════════════════════════════════════════════════════════════
-- Done! Database wiped and rebuilt from scratch.
-- ═══════════════════════════════════════════════════════════════════
