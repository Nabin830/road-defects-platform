-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — photo checks (live camera, GPS, reused photos)
--
-- Run ONCE in the Supabase SQL Editor. Keeps all your data.
-- (00-all-in-one.sql and 00-final.sql already include this.)
--
-- Every report and timeline photo now carries how it was taken (live
-- camera or uploaded), when, where (GPS + accuracy) and a fingerprint.
-- The database — not the website — works out the warnings council sees:
--   uploaded        not taken with the live camera
--   reused_photo    looks the same as a photo on another report
--   weak_gps        GPS accuracy worse than 50 m
--   no_gps          no GPS position with a camera photo
--   far_from_pin    report photo taken over 150 m from the report's pin
--   far_from_defect contractor photo taken over 150 m from the defect
--   clock_mismatch  phone clock more than 5 min ahead / 1 hour behind the server
-- ═══════════════════════════════════════════════════════════════════

-- ─── Photo checks: live camera, GPS, fingerprint of reused photos ───
alter table public.defects
  add column if not exists photo_source   text check (photo_source in ('camera', 'upload')),
  add column if not exists photo_hash     text check (photo_hash ~ '^[0-9a-f]{16}$'),
  add column if not exists photo_taken_at timestamptz,
  add column if not exists photo_lat      numeric(10,7),
  add column if not exists photo_lng      numeric(10,7),
  add column if not exists photo_accuracy numeric(9,1),
  add column if not exists photo_flags    text[] not null default '{}';

alter table public.repair_updates
  add column if not exists photo_source   text check (photo_source in ('camera', 'upload')),
  add column if not exists photo_hash     text check (photo_hash ~ '^[0-9a-f]{16}$'),
  add column if not exists photo_taken_at timestamptz,
  add column if not exists photo_lat      numeric(10,7),
  add column if not exists photo_lng      numeric(10,7),
  add column if not exists photo_accuracy numeric(9,1),
  add column if not exists photo_flags    text[] not null default '{}';

-- Number of differing bits between two 64-bit fingerprints (0 = same picture)
create or replace function public.photo_hash_distance(a text, b text)
returns int as $$
  select length(replace((('x' || a)::bit(64) # ('x' || b)::bit(64))::text, '0', ''));
$$ language sql immutable set search_path = public;

create or replace function public.check_photo_evidence()
returns trigger as $$
declare
  flags    text[] := '{}';
  pin_lat  numeric;
  pin_lng  numeric;
  far_flag text;
  self_id  text;      -- the defect this photo belongs to
begin
  if tg_table_name = 'defects' then
    -- Warnings belong to the photo: they only change when a new photo is attached
    if tg_op = 'UPDATE' then
      if new.photo_url is not distinct from old.photo_url then
        new.photo_flags := old.photo_flags;
        return new;
      end if;
    end if;
    pin_lat := new.latitude; pin_lng := new.longitude; far_flag := 'far_from_pin'; self_id := new.id;
  else
    select latitude, longitude into pin_lat, pin_lng from public.defects where id = new.defect_id;
    far_flag := 'far_from_defect'; self_id := new.defect_id;
  end if;

  if coalesce(new.photo_url, '') = '' then
    new.photo_flags := '{}';
    return new;
  end if;

  if new.photo_source is distinct from 'camera' then
    flags := flags || 'uploaded'::text;
  else
    if new.photo_lat is null or new.photo_lng is null then
      flags := flags || 'no_gps'::text;
    else
      if new.photo_accuracy is null or new.photo_accuracy > 50 then
        flags := flags || 'weak_gps'::text;
      end if;
      if pin_lat is not null and public.metres_between(new.photo_lat, new.photo_lng, pin_lat, pin_lng) > 150 then
        flags := flags || far_flag;
      end if;
    end if;
    if new.photo_taken_at is null or new.photo_taken_at > now() + interval '5 minutes'
       or new.photo_taken_at < now() - interval '1 hour' then
      flags := flags || 'clock_mismatch'::text;
    end if;
  end if;

  -- Same picture on a different report (≤ 5 bits apart), or an exact copy within this one
  -- (a repair's "after" photo shows the same spot as the "before", so only near-exact copies count there)
  if new.photo_hash is not null and (
       exists (select 1 from public.defects d
                where d.photo_hash is not null and d.id <> self_id
                  and public.photo_hash_distance(d.photo_hash, new.photo_hash) <= 5)
    or exists (select 1 from public.repair_updates u
                where u.photo_hash is not null and u.defect_id <> self_id
                  and public.photo_hash_distance(u.photo_hash, new.photo_hash) <= 5)
    or (tg_table_name = 'repair_updates' and exists (
               select 1 from public.defects d
                where d.id = self_id and d.photo_hash is not null
                  and public.photo_hash_distance(d.photo_hash, new.photo_hash) <= 1))
    or exists (select 1 from public.repair_updates u
                where u.defect_id = self_id and u.photo_hash is not null
                  and public.photo_hash_distance(u.photo_hash, new.photo_hash) <= 1)
  ) then
    flags := flags || 'reused_photo'::text;
  end if;

  new.photo_flags := flags;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_photo_checks on public.defects;
create trigger trg_defects_photo_checks before insert or update on public.defects
  for each row execute function public.check_photo_evidence();
drop trigger if exists trg_updates_photo_checks on public.repair_updates;
create trigger trg_updates_photo_checks before insert on public.repair_updates
  for each row execute function public.check_photo_evidence();

-- Contractor finishes a job — now also saves how the "after" photo was taken
drop function if exists public.complete_job(text, text, text);
create or replace function public.complete_job(p_defect_id text, p_note text, p_photo_url text, p_photo jsonb default null)
returns void as $$
begin
  if not public.is_contractor() then
    raise exception 'Only contractors can complete jobs';
  end if;
  if coalesce(trim(p_photo_url), '') = '' then
    raise exception 'A photo of the finished repair is required.';
  end if;
  if not exists (select 1 from public.defects
                  where id = p_defect_id and contractor_id = public.my_contractor_id() and status = 'progress') then
    raise exception 'This job is not in progress for your company.';
  end if;
  insert into public.repair_updates (defect_id, action, note, progress, photo_url, actor_id, actor_role,
                                     photo_source, photo_hash, photo_taken_at, photo_lat, photo_lng, photo_accuracy)
  values (p_defect_id, 'Repair complete', coalesce(nullif(trim(p_note), ''), 'Site cleared. Waiting for council to verify.'),
          100, p_photo_url, auth.uid(), 'contractor',
          p_photo->>'photo_source', p_photo->>'photo_hash', (p_photo->>'photo_taken_at')::timestamptz,
          (p_photo->>'photo_lat')::numeric, (p_photo->>'photo_lng')::numeric, (p_photo->>'photo_accuracy')::numeric);
  update public.defects set status = 'completed', progress = 100 where id = p_defect_id;
end $$ language plpgsql security definer set search_path = public;

grant execute on function public.complete_job(text, text, text, jsonb) to authenticated;
