-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — ALL-IN-ONE Supabase Setup
--
-- Paste this whole file into Supabase SQL Editor and click "Run".
--
-- It does everything, in order:
--   STEP 0. WIPE      — deletes ALL previous tables, data, functions,
--                       triggers and policies in the public schema
--   STEP 1. SCHEMA    — tables, indexes, triggers
--   STEP 2. POLICIES  — row level security
--   STEP 3. FOLLOWERS — "follow updates" table + in-app notifications
--   STEP 4. STORAGE   — defect-photos bucket + policies
--   STEP 5. USERS     — re-creates profiles for existing auth users and
--                       makes council@gmail.com an admin
--
-- No dummy data: contractors, defects, updates etc. all start EMPTY.
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

-- Delete the old demo login accounts (citizen@/contractor@/admin@example.com)
delete from auth.users where lower(email) like '%@example.com';

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
  accepted_at    timestamptz,                         -- set when the contractor accepts the job
  verified_at    timestamptz,                         -- set when council verifies the completed repair
  work_instructions text,                             -- council's work order: what the contractor must do
  due_at         timestamptz,                         -- council-set fix-by date (overrides severity default)
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

-- ─── Only council can verify, and verified jobs are locked ────────
-- auth.uid() is null in the SQL Editor, so manual fixes there still work.
create or replace function public.guard_verification()
returns trigger as $$
begin
  -- Vote-count refreshes are always allowed
  if (to_jsonb(new) - 'votes' - 'updated_at') = (to_jsonb(old) - 'votes' - 'updated_at') then
    return new;
  end if;
  if auth.uid() is not null and not public.is_admin() then
    if old.verified_at is not null then
      raise exception 'This repair has been verified and closed by council';
    end if;
    if new.verified_at is distinct from old.verified_at then
      raise exception 'Only council can verify a repair';
    end if;
    if new.work_instructions is distinct from old.work_instructions
       or new.due_at is distinct from old.due_at then
      raise exception 'Only council can set the work order and fix-by date';
    end if;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

create trigger trg_defects_guard_verification before update on public.defects
  for each row execute function public.guard_verification();

-- ─── AUTO-CREATE profile on signup ────────────────────────────────
-- "Summit Asphalt" → "SA"
create or replace function public.initials(p_name text)
returns text as $$
  select upper(coalesce(nullif(
    string_agg(left(w, 1), '' order by ord), ''), '?'))
    from (select w, ord from unnest(regexp_split_to_array(trim(p_name), '\s+')) with ordinality as t(w, ord)
           where w <> '' limit 2) x;
$$ language sql immutable;

-- Only 'citizen' or 'contractor' can be chosen at signup; admin is granted by SQL.
-- Contractors automatically get their own row in public.contractors so the
-- council can assign work to them straight away.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_name   text := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_role   text := case when new.raw_user_meta_data->>'role' = 'contractor' then 'contractor' else 'citizen' end;
  v_con_id uuid;
begin
  if v_role = 'contractor' then
    insert into public.contractors (name, abbr)
    values (v_name, public.initials(v_name))
    returning id into v_con_id;
  end if;

  insert into public.profiles (id, email, name, role, suburb, contractor_id)
  values (new.id, new.email, v_name, v_role, new.raw_user_meta_data->>'suburb', v_con_id)
  on conflict (id) do nothing;
  return new;
end $$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── VOTE COUNTER (keeps defects.votes in sync) ───────────────────
-- security definer: citizens can't edit defects directly, but their vote
-- still has to update the count.
create or replace function public.recount_votes()
returns trigger as $$
begin
  update public.defects
     set votes = (select count(*) from public.votes where defect_id = coalesce(new.defect_id, old.defect_id))
   where id = coalesce(new.defect_id, old.defect_id);
  return null;
end $$ language plpgsql security definer set search_path = public;

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

-- ─── Contractor declines an assigned job ──────────────────────────
-- Sends the defect back to 'pending' (unassigned) so the council can
-- pick another contractor. Runs as definer because the contractor's own
-- update policy doesn't allow clearing contractor_id.
create or replace function public.decline_assignment(p_defect_id text, p_reason text)
returns void as $$
begin
  if not public.is_contractor() then
    raise exception 'Only contractors can decline jobs';
  end if;

  update public.defects
     set status = 'pending', contractor_id = null, accepted_at = null, progress = 0
   where id = p_defect_id
     and contractor_id = public.my_contractor_id()
     and status = 'assigned';

  if not found then
    raise exception 'This job is not assigned to you or has already started';
  end if;

  insert into public.repair_updates (defect_id, action, note, progress, actor_id, actor_role)
  values (p_defect_id, 'Contractor declined', nullif(trim(p_reason), ''), 0, auth.uid(), 'contractor');
end $$ language plpgsql security definer set search_path = public;

grant execute on function public.decline_assignment(text, text) to authenticated;

-- ─── Council changes someone's role (People page) ─────────────────
-- Making someone a contractor links them to a company — an existing one, or a
-- new one named after them. Council can't remove the last admin.
create or replace function public.admin_set_role(p_user uuid, p_role text, p_contractor uuid default null)
returns void as $$
declare
  v_name text;
  v_con  uuid := p_contractor;
begin
  if not public.is_admin() then
    raise exception 'Only council can change roles';
  end if;
  if p_role not in ('citizen', 'contractor', 'admin') then
    raise exception 'Unknown role %', p_role;
  end if;
  if p_role <> 'admin'
     and exists (select 1 from public.profiles where id = p_user and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'There must be at least one council admin';
  end if;

  if p_role = 'contractor' then
    if v_con is null then
      select contractor_id into v_con from public.profiles where id = p_user;
    end if;
    if v_con is null then
      select name into v_name from public.profiles where id = p_user;
      insert into public.contractors (name, abbr) values (v_name, public.initials(v_name)) returning id into v_con;
    end if;
  else
    v_con := null;
  end if;

  update public.profiles set role = p_role, contractor_id = v_con where id = p_user;
  if not found then raise exception 'User not found'; end if;
end $$ language plpgsql security definer set search_path = public;

grant execute on function public.admin_set_role(uuid, text, uuid) to authenticated;

-- Same rule however the row is changed
create or replace function public.guard_last_admin()
returns trigger as $$
begin
  if old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'There must be at least one council admin';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

create trigger trg_profiles_last_admin before update of role on public.profiles
  for each row execute function public.guard_last_admin();

-- ─── PROFILES ─────────────────────────────────────────────────────
-- Profiles hold emails and phone numbers: you see your own, council sees everyone's
create policy "Profiles: users read their own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: council reads all"
  on public.profiles for select
  using (public.is_admin());

create policy "Profiles: users update their own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and contractor_id is not distinct from (select contractor_id from public.profiles where id = auth.uid())
  );
  -- users can edit their name/phone/suburb, but not their role or which company they belong to

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

-- A contractor can rename their own company (Profile & settings page)
create policy "Contractors: update own company"
  on public.contractors for update
  using (id = public.my_contractor_id())
  with check (id = public.my_contractor_id());

-- ─── DEFECTS ──────────────────────────────────────────────────────
create policy "Defects: everyone can read"
  on public.defects for select using (true);

create policy "Defects: authenticated users can create"
  on public.defects for insert
  with check (auth.uid() = reported_by);

create policy "Defects: reporter can edit while pending"
  on public.defects for update
  using (auth.uid() = reported_by and status = 'pending')
  with check (auth.uid() = reported_by and status = 'pending' and contractor_id is null);

create policy "Defects: contractors update assigned work"
  on public.defects for update
  using (public.is_contractor() and contractor_id = public.my_contractor_id())
  with check (contractor_id = public.my_contractor_id() and status in ('assigned', 'progress', 'completed'));

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


-- ─── Anti-spam: report quality and rate limits ────────────────────
-- Title/description minimums (NOT VALID so older short test reports don't block this)
alter table public.defects drop constraint if exists defects_title_len;
alter table public.defects add constraint defects_title_len
  check (char_length(trim(title)) between 8 and 100) not valid;
alter table public.defects drop constraint if exists defects_description_len;
alter table public.defects add constraint defects_description_len
  check (char_length(trim(description)) between 20 and 2000) not valid;

-- One report a minute, 10 a day, and no repeat of the same report within an hour.
-- Council is exempt; auth.uid() is null in the SQL Editor so manual inserts still work.
create or replace function public.limit_report_rate()
returns trigger as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if exists (select 1 from public.defects
              where reported_by = auth.uid() and reported_at > now() - interval '1 minute') then
    raise exception 'Please wait a minute before sending another report.';
  end if;
  if (select count(*) from public.defects
       where reported_by = auth.uid() and reported_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent 10 reports today. Please try again tomorrow.';
  end if;
  if exists (select 1 from public.defects
              where reported_by = auth.uid() and reported_at > now() - interval '1 hour'
                and lower(trim(title)) = lower(trim(new.title)) and lower(trim(road)) = lower(trim(new.road))) then
    raise exception 'You already reported this in the last hour.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_rate_limit on public.defects;
create trigger trg_defects_rate_limit before insert on public.defects
  for each row execute function public.limit_report_rate();

-- ─── Address lookup cache (used by the "geocode" Edge Function) ───
create table if not exists public.geocode_cache (
  key        text primary key,          -- r:<lat>,<lng> or s:<search text>
  result     jsonb not null,
  created_at timestamptz not null default now()
);
-- Only the Edge Function (service role) reads/writes it; no public access
alter table public.geocode_cache enable row level security;

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


-- ─── NOTIFICATIONS (bell in the header) ───────────────────────────
-- One row per recipient, created automatically whenever a repair update
-- is added to a defect.
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  defect_id    text references public.defects(id) on delete cascade,
  defect_title text,
  kind         text not null default 'update',     -- report/assigned/accepted/declined/progress/complete/verified/rework/rejected/update
  title        text not null,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Notifications: users read their own"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Notifications: users mark their own read"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Notifications: users delete their own"
  on public.notifications for delete using (auth.uid() = user_id);

-- Who hears about an update:
--   the reporter, followers, the assigned contractor's accounts, and council
--   (council only for updates made by citizens/contractors) — never the person who acted.
create or replace function public.notify_on_update()
returns trigger as $$
declare
  d      public.defects%rowtype;
  v_kind text;
begin
  select * into d from public.defects where id = new.defect_id;
  if not found then return new; end if;

  v_kind := case new.action
    when 'Report submitted'    then 'report'
    when 'Assigned'            then 'assigned'
    when 'Contractor accepted' then 'accepted'
    when 'Contractor declined' then 'declined'
    when 'Work started'        then 'progress'
    when 'Progress update'     then 'progress'
    when 'Repair complete'     then 'complete'
    when 'Verified by council' then 'verified'
    when 'Rework requested'    then 'rework'
    when 'Report rejected'     then 'rejected'
    else 'update' end;

  insert into public.notifications (user_id, defect_id, defect_title, kind, title, body)
  select r.uid, d.id, d.title, v_kind,
         case
           when v_kind = 'report'   then 'New defect reported'
           when v_kind = 'assigned' and r.is_contractor then 'New job assigned to you'
           when v_kind = 'assigned' then 'Contractor assigned'
           when v_kind = 'complete' and r.is_admin      then 'Repair ready for verification'
           when v_kind = 'rework'   and r.is_contractor then 'Council requested rework'
           else new.action
         end,
         new.note
    from (
      select p.id as uid,
             bool_or(p.role = 'admin') as is_admin,
             bool_or(p.role = 'contractor' and p.contractor_id = d.contractor_id) as is_contractor
        from public.profiles p
       where p.id = d.reported_by
          or p.id in (select f.user_id from public.followers f where f.defect_id = d.id)
          or (p.role = 'contractor' and d.contractor_id is not null and p.contractor_id = d.contractor_id)
          or (p.role = 'admin' and coalesce(new.actor_role, '') <> 'admin')
       group by p.id
    ) r
   where r.uid is distinct from new.actor_id;

  return new;
end $$ language plpgsql security definer set search_path = public;

create trigger trg_repair_updates_notify after insert on public.repair_updates
  for each row execute function public.notify_on_update();

-- Live updates for the bell (Supabase Realtime), when available
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


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
-- STEP 5. USERS
-- ═══════════════════════════════════════════════════════════════════

-- Re-create a profile for every account that already exists in
-- Authentication (the wipe in STEP 0 deleted the old profiles table).
insert into public.profiles (id, email, name, role, suburb)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data->>'role' = 'contractor' then 'contractor' else 'citizen' end,
       u.raw_user_meta_data->>'suburb'
  from auth.users u
 where u.email is not null
on conflict (id) do nothing;

-- Give every existing contractor account its own contractors row
do $$
declare
  p record;
  v_id uuid;
begin
  for p in select id, name from public.profiles where role = 'contractor' and contractor_id is null loop
    insert into public.contractors (name, abbr) values (p.name, public.initials(p.name)) returning id into v_id;
    update public.profiles set contractor_id = v_id where id = p.id;
  end loop;
end $$;

-- Council admin account
update public.profiles
   set role = 'admin', contractor_id = null
 where lower(email) = 'council@gmail.com';

-- ─── Confirm ──────────────────────────────────────────────────────
select 'contractors'    as "table", count(*) as rows from public.contractors
union all select 'defects',        count(*) from public.defects
union all select 'repair_updates', count(*) from public.repair_updates
union all select 'profiles',       count(*) from public.profiles;

-- ═══════════════════════════════════════════════════════════════════
-- Done! Database wiped and rebuilt from scratch.
-- ═══════════════════════════════════════════════════════════════════
