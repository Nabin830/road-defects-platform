-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — upgrades (anti-spam limits, address lookup cache)
--
-- Run this ONCE in the Supabase SQL Editor on an existing database,
-- after 01-work-orders.sql. It keeps all your data.
-- ═══════════════════════════════════════════════════════════════════

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
