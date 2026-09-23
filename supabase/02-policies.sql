-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Platform — Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER 01-schema.sql
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS on every table
alter table public.profiles       enable row level security;
alter table public.contractors    enable row level security;
alter table public.defects        enable row level security;
alter table public.repair_updates enable row level security;
alter table public.votes          enable row level security;

-- ─── Helper: is this user an admin? ───────────────────────────────
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- ─── Helper: is this user a contractor? ───────────────────────────
create or replace function public.is_contractor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contractor'
  );
$$ language sql stable security definer;

-- ─── Helper: get contractor_id for current user ───────────────────
create or replace function public.my_contractor_id()
returns uuid as $$
  select contractor_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ═══════════════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists "Profiles: anyone signed-in can read"       on public.profiles;
drop policy if exists "Profiles: users update their own"          on public.profiles;
drop policy if exists "Profiles: admins update anyone"            on public.profiles;

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

-- ═══════════════════════════════════════════════════════════════════
-- CONTRACTORS
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists "Contractors: everyone can read"    on public.contractors;
drop policy if exists "Contractors: admins can write"     on public.contractors;

create policy "Contractors: everyone can read"
  on public.contractors for select using (true);

create policy "Contractors: admins can write"
  on public.contractors for all
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- DEFECTS
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists "Defects: everyone can read"                 on public.defects;
drop policy if exists "Defects: authenticated users can create"    on public.defects;
drop policy if exists "Defects: reporter can edit while pending"   on public.defects;
drop policy if exists "Defects: contractors update assigned work"  on public.defects;
drop policy if exists "Defects: admins can do anything"            on public.defects;

-- Public map: anyone can browse defects
create policy "Defects: everyone can read"
  on public.defects for select using (true);

-- Any signed-in citizen can report a defect
create policy "Defects: authenticated users can create"
  on public.defects for insert
  with check (auth.uid() = reported_by);

-- Reporter can edit their own defect only while pending
create policy "Defects: reporter can edit while pending"
  on public.defects for update
  using (auth.uid() = reported_by and status = 'pending')
  with check (auth.uid() = reported_by);

-- Contractor can update status/progress on assigned work
create policy "Defects: contractors update assigned work"
  on public.defects for update
  using (public.is_contractor() and contractor_id = public.my_contractor_id());

-- Admins full control
create policy "Defects: admins can do anything"
  on public.defects for all
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- REPAIR UPDATES
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists "Updates: everyone can read"     on public.repair_updates;
drop policy if exists "Updates: signed-in can insert"  on public.repair_updates;
drop policy if exists "Updates: admins can delete"     on public.repair_updates;

create policy "Updates: everyone can read"
  on public.repair_updates for select using (true);

create policy "Updates: signed-in can insert"
  on public.repair_updates for insert
  with check (auth.uid() = actor_id);

create policy "Updates: admins can delete"
  on public.repair_updates for delete
  using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- VOTES
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists "Votes: everyone can read"        on public.votes;
drop policy if exists "Votes: users manage their own"   on public.votes;

create policy "Votes: everyone can read"
  on public.votes for select using (true);

create policy "Votes: users manage their own"
  on public.votes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- Done!
-- ═══════════════════════════════════════════════════════════════════
