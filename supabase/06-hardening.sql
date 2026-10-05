-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — hardening
--
-- Run this ONCE in the Supabase SQL Editor, after 01–05. Keeps your data.
--   • contractors can only rename their company (not its rating or crew size)
--   • text limits on addresses, notes, work orders, reasons and profile names
--   • people can't back their own report, or a closed one
--   • at most 20 timeline posts per person per job per day (each one notifies followers)
--   • profile picture links can't be set (the app doesn't use them)
--   • notifications older than 90 days are cleared automatically
--   • report IDs must use the RD-XXXXXX format
--   • indexes so these checks stay fast as data grows
-- ═══════════════════════════════════════════════════════════════════

-- ─── Hardening: company edits, text limits, fair backing, timeline flood limit ───

-- Contractors may rename their own company, nothing else (rating, crew size and code are council's)
create or replace function public.guard_company()
returns trigger as $$
begin
  -- auth.uid() is null for system work (sign-up trigger, SQL Editor): don't block those
  if auth.uid() is null or public.trusted() then return new; end if;
  if char_length(trim(new.name)) not between 2 and 80 then
    raise exception 'Company name must be 2 to 80 characters.';
  end if;
  new.name := trim(new.name);
  if tg_op = 'INSERT' or public.is_admin() then return new; end if;
  if not public.changed_columns(to_jsonb(new), to_jsonb(old)) <@ array['name', 'abbr'] then
    raise exception 'You can only change your company name.';
  end if;
  new.abbr := public.initials(new.name);   -- keep the badge code in step with the name
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_contractors_guard on public.contractors;
create trigger trg_contractors_guard before insert or update on public.contractors
  for each row execute function public.guard_company();

-- Sensible text limits (a trigger, not CHECK, so older rows can still be updated;
-- only text that is being written is checked)
create or replace function public.check_text_limits()
returns trigger as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  lim jsonb := tg_argv[0]::jsonb;
  k text;
begin
  if auth.uid() is null then return new; end if;   -- system work (sign-up, SQL Editor)
  for k in select jsonb_object_keys(lim) loop
    if n ->> k is not null and (tg_op = 'INSERT' or n -> k is distinct from o -> k)
       and char_length(n ->> k) > (lim ->> k)::int then
      raise exception '% is too long (max % characters).',
        case k when 'road' then 'Address' when 'work_instructions' then 'Work order'
               when 'reject_reason' then 'Reason' when 'photo_url' then 'Photo link'
               else initcap(replace(k, '_', ' ')) end, lim ->> k;
    end if;
  end loop;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_defects_text_limits on public.defects;
create trigger trg_defects_text_limits before insert or update on public.defects
  for each row execute function public.check_text_limits(
    '{"road":200,"suburb":80,"depth":60,"width":60,"work_instructions":2000,"reject_reason":500,"photo_url":500}');
drop trigger if exists trg_updates_text_limits on public.repair_updates;
create trigger trg_updates_text_limits before insert on public.repair_updates
  for each row execute function public.check_text_limits('{"note":2000,"action":60,"photo_url":500}');
drop trigger if exists trg_profiles_text_limits on public.profiles;
create trigger trg_profiles_text_limits before insert or update on public.profiles
  for each row execute function public.check_text_limits('{"name":80,"phone":30,"suburb":80}');

-- Backing is for other people's open reports
create or replace function public.check_vote()
returns trigger as $$
declare d public.defects%rowtype;
begin
  select * into d from public.defects where id = new.defect_id;
  if d.reported_by = new.user_id then
    raise exception 'You can''t back your own report.';
  end if;
  if d.status in ('completed', 'rejected') then
    raise exception 'This report is closed.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_votes_check on public.votes;
create trigger trg_votes_check before insert on public.votes
  for each row execute function public.check_vote();

-- Timeline flood limit: each entry notifies followers, so cap non-council posts per job per day
create or replace function public.limit_timeline_rate()
returns trigger as $$
begin
  if auth.uid() is null or public.trusted() or public.is_admin() then return new; end if;
  if (select count(*) from public.repair_updates
       where defect_id = new.defect_id and actor_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many updates on this job today. Please try again tomorrow.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_updates_rate on public.repair_updates;
create trigger trg_updates_rate before insert on public.repair_updates
  for each row execute function public.limit_timeline_rate();

-- avatar_url isn't used by the app; stop people setting it
create or replace function public.guard_profile()
returns trigger as $$
declare bad text[];
begin
  if auth.uid() is null or public.trusted() or public.is_admin() then return new; end if;
  bad := array(select unnest(public.changed_columns(to_jsonb(new), to_jsonb(old)))
               except select unnest(array['name', 'phone', 'suburb']));
  if cardinality(bad) > 0 then
    raise exception 'You can only change your name, phone and suburb (not %).', array_to_string(bad, ', ');
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

-- Keep the notifications table small: each new notification clears that person's ones older than 90 days
create or replace function public.prune_notifications()
returns trigger as $$
begin
  delete from public.notifications
   where user_id = new.user_id and created_at < now() - interval '90 days';
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notifications_prune on public.notifications;
create trigger trg_notifications_prune after insert on public.notifications
  for each row execute function public.prune_notifications();

-- Report IDs are generated by the app; refuse anything that isn't the RD-XXXXXX format
create or replace function public.sanitize_new_report()
returns trigger as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.id !~ '^RD-[A-Z0-9]{6,14}$' then
    raise exception 'Invalid report ID.';
  end if;
  new.status := 'pending';           new.votes := 0;              new.progress := 0;
  new.contractor_id := null;         new.accepted_at := null;     new.verified_at := null;
  new.reject_reason := null;         new.work_instructions := null; new.due_at := null;
  new.reported_at := now();          new.updated_at := now();
  if not public.in_council_area(new.latitude, new.longitude) then
    raise exception 'RoadFix only covers roads in the Orange City Council area.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

-- Indexes for the checks that run on every report, vote and timeline post
create index if not exists idx_defects_reporter_time on public.defects(reported_by, reported_at desc);  -- spam limits
create index if not exists idx_profiles_contractor  on public.profiles(contractor_id);                  -- who hears about a job
create index if not exists idx_updates_actor_defect on public.repair_updates(defect_id, actor_id, created_at desc); -- timeline flood limit
create index if not exists idx_updates_milestones   on public.repair_updates(action, created_at)
  where action in ('Assigned', 'Repair complete');                                                     -- council reports
