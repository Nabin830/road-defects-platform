-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — workflow rules
--
-- Run this ONCE in the Supabase SQL Editor, after 01, 02 and 03. Keeps your data.
--   • reports need a photo and a real-words title
--   • a new report within 150 m of an open report from the last hour is blocked
--   • status must follow the stages (no skipping)
--   • contractors must attach photos to progress updates and to completion
-- ═══════════════════════════════════════════════════════════════════

-- ─── Workflow rules: stage order, photo evidence, duplicates ──────
-- Distance in metres between two points (haversine)
create or replace function public.metres_between(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns double precision as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2) +
    cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2)));
$$ language sql immutable;

-- Title/description rules + required photo. A trigger, not a CHECK constraint, so older
-- rows can still be updated; only new reports and edited text are checked.
create or replace function public.check_report_text()
returns trigger as $$
declare letters text;
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title then
    if char_length(trim(new.title)) not between 8 and 100 then
      raise exception 'Title must be 8 to 100 characters.';
    end if;
    -- real words, not keyboard mashing: 4+ letters, 3+ different letters, and a space or 12+ characters
    letters := lower(regexp_replace(new.title, '[^a-zA-Z]', '', 'g'));
    if char_length(letters) < 4
       or (select count(distinct c) from regexp_split_to_table(letters, '') c) < 3
       or (trim(new.title) !~ '\s' and char_length(trim(new.title)) < 12) then
      raise exception 'Please write the title in real words.';
    end if;
  end if;
  if tg_op = 'INSERT' or new.description is distinct from old.description then
    if char_length(trim(new.description)) not between 20 and 2000 then
      raise exception 'Description must be 20 to 2000 characters.';
    end if;
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null and coalesce(trim(new.photo_url), '') = '' then
    raise exception 'A photo of the defect is required.';
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_defects_check_text on public.defects;
create trigger trg_defects_check_text before insert or update on public.defects
  for each row execute function public.check_report_text();

-- Rate limits + duplicate blocking. Council is exempt; auth.uid() is null in the SQL Editor.
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
              where status not in ('completed', 'rejected')
                and reported_at > now() - interval '1 hour'
                and public.metres_between(latitude, longitude, new.latitude, new.longitude) <= 150) then
    raise exception 'This was already reported within 150 m in the last hour. Open that report and tap "Back this report" instead.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_rate_limit on public.defects;
create trigger trg_defects_rate_limit before insert on public.defects
  for each row execute function public.limit_report_rate();

-- Stage order. Every status change must be one of these steps:
--   pending → assigned | rejected                 (council)
--   assigned → assigned (reassign) | rejected      (council)
--   assigned → progress                            (contractor accepts)
--   assigned → pending                             (contractor declines)
--   progress → completed                           (contractor, with a completion photo)
--   progress → assigned | rejected                 (council reassigns / rejects)
--   completed → progress                           (council asks for rework)
--   rejected → assigned                            (council reopens)
create or replace function public.enforce_status_flow()
returns trigger as $$
declare
  admin boolean := public.is_admin();
  step  text := old.status || '>' || new.status;
begin
  if auth.uid() is null or new.status = old.status and not (admin and new.contractor_id is distinct from old.contractor_id) then
    return new;
  end if;
  if admin and step in ('pending>assigned', 'pending>rejected', 'assigned>assigned', 'assigned>rejected',
                        'progress>assigned', 'progress>rejected', 'completed>progress', 'rejected>assigned') then
    return new;
  end if;
  if step = 'assigned>progress' then
    if new.accepted_at is null then
      raise exception 'The contractor must accept the job before work starts.';
    end if;
    return new;
  end if;
  if step = 'assigned>pending' and not admin then
    return new;   -- contractor declining (decline_assignment)
  end if;
  if step = 'progress>completed' then
    if not exists (select 1 from public.repair_updates
                    where defect_id = new.id and action = 'Repair complete'
                      and coalesce(photo_url, '') <> '' and created_at >= now() - interval '10 minutes') then
      raise exception 'A photo of the finished repair is required to mark the job complete.';
    end if;
    return new;
  end if;
  raise exception 'A report can''t go from "%" to "%". Follow the stages: pending → assigned → in progress → completed → verified.',
    old.status, new.status;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_status_flow on public.defects;
create trigger trg_defects_status_flow before update on public.defects
  for each row execute function public.enforce_status_flow();

-- Contractors must attach a photo to progress updates and the completion update
create or replace function public.require_contractor_photo()
returns trigger as $$
begin
  if new.actor_role = 'contractor' and new.action in ('Progress update', 'Repair complete')
     and coalesce(trim(new.photo_url), '') = '' then
    raise exception 'Contractors must attach a photo to % entries.', lower(new.action);
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_updates_require_photo on public.repair_updates;
create trigger trg_updates_require_photo before insert on public.repair_updates
  for each row execute function public.require_contractor_photo();

-- Contractor finishes a job: the photo update and the status change happen together
create or replace function public.complete_job(p_defect_id text, p_note text, p_photo_url text)
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
  insert into public.repair_updates (defect_id, action, note, progress, photo_url, actor_id, actor_role)
  values (p_defect_id, 'Repair complete', coalesce(nullif(trim(p_note), ''), 'Site cleared. Waiting for council to verify.'),
          100, p_photo_url, auth.uid(), 'contractor');
  update public.defects set status = 'completed', progress = 100 where id = p_defect_id;
end $$ language plpgsql security definer set search_path = public;

grant execute on function public.complete_job(text, text, text) to authenticated;
