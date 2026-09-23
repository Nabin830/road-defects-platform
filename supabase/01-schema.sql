-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Assessment Platform — Complete Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════

-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends auth.users) ────────────────────────────────
-- Supabase Auth handles user accounts; this adds role/name/etc.
create table if not exists public.profiles (
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
create table if not exists public.contractors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  abbr       text not null,
  crew_size  int  not null default 4,
  rating     numeric(2,1) default 4.5,
  created_at timestamptz not null default now()
);

-- ─── DEFECTS ──────────────────────────────────────────────────────
create table if not exists public.defects (
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
create table if not exists public.repair_updates (
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
create table if not exists public.votes (
  defect_id  text not null references public.defects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (defect_id, user_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────
create index if not exists idx_defects_status         on public.defects(status);
create index if not exists idx_defects_severity       on public.defects(severity);
create index if not exists idx_defects_reported_by    on public.defects(reported_by);
create index if not exists idx_defects_contractor_id  on public.defects(contractor_id);
create index if not exists idx_defects_reported_at    on public.defects(reported_at desc);
create index if not exists idx_updates_defect_id      on public.repair_updates(defect_id, created_at desc);
create index if not exists idx_profiles_role          on public.profiles(role);

-- ─── AUTO-UPDATE timestamps ───────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_defects_touch on public.defects;
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

drop trigger if exists on_auth_user_created on auth.users;
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

drop trigger if exists trg_votes_recount on public.votes;
create trigger trg_votes_recount after insert or delete on public.votes
  for each row execute function public.recount_votes();

-- ═══════════════════════════════════════════════════════════════════
-- Done! Now run 02-policies.sql, then 03-seed.sql
-- ═══════════════════════════════════════════════════════════════════
