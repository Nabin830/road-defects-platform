-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — anti-tamper rules
--
-- Run this ONCE in the Supabase SQL Editor, after 01–04. Keeps your data.
-- Closes loopholes where someone sends requests straight to the database
-- (skipping the website) to:
--   • create reports pre-marked completed/verified, with fake votes, backdated
--     to dodge the spam limits, pre-assigned, or outside the council area
--   • raise their own report's severity/votes/date, or change their email
--   • post fake "Verified by council" or contractor entries on any timeline
--   • (contractors) rewrite the title/severity/reporter of their jobs, or post on
--     other companies' jobs
-- ═══════════════════════════════════════════════════════════════════

-- ─── Anti-tamper: the database, not the website, decides what each role may change ───
-- Requests can be sent straight to the API, so every rule the app follows is enforced here too.
-- Internal functions that must bypass these checks (vote counting, declining a job) set a
-- transaction-local flag; clients can't set it because set_config isn't exposed by the API.
create or replace function public.trusted()
returns boolean as $$
  select coalesce(current_setting('roadfix.trusted', true), '') = 'on';
$$ language sql stable;

-- Generous box around the Orange City Council area (matches the app's COUNCIL_AREA)
create or replace function public.in_council_area(lat numeric, lng numeric)
returns boolean as $$
  select lat between -33.48 and -33.12 and lng between 148.88 and 149.30;
$$ language sql immutable;

-- Columns whose value differs between two versions of a row (ignores updated_at)
create or replace function public.changed_columns(a jsonb, b jsonb)
returns text[] as $$
  select coalesce(array_agg(k), '{}') from jsonb_object_keys(a) k
   where k <> 'updated_at' and a -> k is distinct from b -> k;
$$ language sql immutable;

-- Profiles: people may change only their name, phone, suburb and avatar
create or replace function public.guard_profile()
returns trigger as $$
declare bad text[];
begin
  if auth.uid() is null or public.trusted() or public.is_admin() then return new; end if;
  bad := array(select unnest(public.changed_columns(to_jsonb(new), to_jsonb(old)))
               except select unnest(array['name', 'phone', 'suburb', 'avatar_url']));
  if cardinality(bad) > 0 then
    raise exception 'You can only change your name, phone and suburb (not %).', array_to_string(bad, ', ');
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- New reports always start clean: pending, no votes, no contractor, stamped now, inside the council area.
-- Named "_a_" so it runs before the rate-limit trigger (which relies on reported_at).
create or replace function public.sanitize_new_report()
returns trigger as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.status := 'pending';           new.votes := 0;              new.progress := 0;
  new.contractor_id := null;         new.accepted_at := null;     new.verified_at := null;
  new.reject_reason := null;         new.work_instructions := null; new.due_at := null;
  new.reported_at := now();          new.updated_at := now();
  if not public.in_council_area(new.latitude, new.longitude) then
    raise exception 'RoadFix only covers roads in the Orange City Council area.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_a_sanitize on public.defects;
create trigger trg_defects_a_sanitize before insert on public.defects
  for each row execute function public.sanitize_new_report();

-- Updates: contractors may move their own jobs along (status, progress, accepted time);
-- reporters may fix the wording, photo and location of their own report while it's pending.
create or replace function public.guard_defect_columns()
returns trigger as $$
declare
  changed text[] := public.changed_columns(to_jsonb(new), to_jsonb(old));
  allowed text[];
begin
  if auth.uid() is null or public.trusted() or public.is_admin() or cardinality(changed) = 0 then
    return new;
  end if;
  if public.is_contractor() and old.contractor_id = public.my_contractor_id() then
    allowed := array['status', 'progress', 'accepted_at'];
  elsif old.reported_by = auth.uid() and old.status = 'pending' then
    allowed := array['title', 'description', 'photo_url', 'road', 'suburb', 'latitude', 'longitude',
                     'defect_type', 'depth', 'width'];
    if not public.in_council_area(new.latitude, new.longitude) then
      raise exception 'RoadFix only covers roads in the Orange City Council area.';
    end if;
  else
    raise exception 'You can''t change this report.';
  end if;
  if not changed <@ allowed then
    raise exception 'You can''t change: %.', array_to_string(array(select unnest(changed) except select unnest(allowed)), ', ');
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_guard_columns on public.defects;
create trigger trg_defects_guard_columns before update on public.defects
  for each row execute function public.guard_defect_columns();

-- Timeline entries must come from the right person, as their real role, about their own work
create or replace function public.guard_timeline_entry()
returns trigger as $$
declare
  me text;
  d  public.defects%rowtype;
begin
  if auth.uid() is null or public.trusted() or public.is_admin() then return new; end if;
  select role into me from public.profiles where id = auth.uid();
  select * into d from public.defects where id = new.defect_id;
  if new.actor_role is distinct from me then
    raise exception 'Timeline entries must be posted as your own role.';
  end if;
  if me = 'citizen' then
    if new.action <> 'Report submitted' or d.reported_by is distinct from auth.uid() or coalesce(new.progress, 0) <> 0 then
      raise exception 'Residents can only log their own new report.';
    end if;
  elsif me = 'contractor' then
    if d.contractor_id is distinct from public.my_contractor_id() then
      raise exception 'This job isn''t assigned to your company.';
    end if;
    if new.action not in ('Contractor accepted', 'Work started', 'Progress update', 'Repair complete') then
      raise exception 'Contractors can''t post "%" entries.', new.action;
    end if;
    if new.progress is not null and new.progress not between 0 and 100 then
      raise exception 'Progress must be between 0 and 100.';
    end if;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_updates_guard on public.repair_updates;
create trigger trg_updates_guard before insert on public.repair_updates
  for each row execute function public.guard_timeline_entry();

-- Vote counting and declining a job are trusted internal steps
create or replace function public.recount_votes()
returns trigger as $$
begin
  perform set_config('roadfix.trusted', 'on', true);
  update public.defects
     set votes = (select count(*) from public.votes where defect_id = coalesce(new.defect_id, old.defect_id))
   where id = coalesce(new.defect_id, old.defect_id);
  perform set_config('roadfix.trusted', 'off', true);
  return null;
end $$ language plpgsql security definer set search_path = public;

create or replace function public.decline_assignment(p_defect_id text, p_reason text)
returns void as $$
begin
  if not public.is_contractor() then
    raise exception 'Only contractors can decline jobs';
  end if;
  if not exists (select 1 from public.defects
                  where id = p_defect_id and contractor_id = public.my_contractor_id() and status = 'assigned') then
    raise exception 'This job is not assigned to you or has already started';
  end if;

  perform set_config('roadfix.trusted', 'on', true);
  update public.defects
     set status = 'pending', contractor_id = null, accepted_at = null, progress = 0
   where id = p_defect_id;
  insert into public.repair_updates (defect_id, action, note, progress, actor_id, actor_role)
  values (p_defect_id, 'Contractor declined', nullif(trim(p_reason), ''), 0, auth.uid(), 'contractor');
  perform set_config('roadfix.trusted', 'off', true);
end $$ language plpgsql security definer set search_path = public;

-- Votes: who backed what stays private (the count is on defects.votes); users see their own
drop policy if exists "Votes: everyone can read" on public.votes;

-- Photo bucket: public links keep working, but nobody can list every user's folder
drop policy if exists "defect-photos: public read" on storage.objects;
drop policy if exists "defect-photos: owner read" on storage.objects;
create policy "defect-photos: owner read"
  on storage.objects for select
  using (bucket_id = 'defect-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Photo links must point at this project's photo bucket — never "javascript:" or other sites
create or replace function public.valid_photo_url(u text)
returns boolean as $$
  select u is null or u ~ '^https://[^/?#]+/storage/v1/object/public/defect-photos/[^?#]+$';
$$ language sql immutable;

create or replace function public.check_photo_urls()
returns trigger as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if not public.valid_photo_url(new.photo_url) then
    raise exception 'Photos must be uploaded through RoadFix.';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_defects_photo_url on public.defects;
create trigger trg_defects_photo_url before insert or update of photo_url on public.defects
  for each row execute function public.check_photo_urls();
drop trigger if exists trg_updates_photo_url on public.repair_updates;
create trigger trg_updates_photo_url before insert on public.repair_updates
  for each row execute function public.check_photo_urls();
