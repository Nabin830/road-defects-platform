-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Platform — Photo Storage
-- Run this in Supabase SQL Editor AFTER 02-policies.sql
-- Creates a public bucket for defect report photos with RLS.
-- ═══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('defect-photos', 'defect-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Anyone can view photos (they're shown on the public defect map)
drop policy if exists "defect-photos: public read" on storage.objects;
create policy "defect-photos: public read"
  on storage.objects for select
  using (bucket_id = 'defect-photos');

-- Any signed-in user can upload into their own folder (path prefix = their user id)
drop policy if exists "defect-photos: authenticated upload" on storage.objects;
create policy "defect-photos: authenticated upload"
  on storage.objects for insert
  with check (
    bucket_id = 'defect-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can delete their own uploads
drop policy if exists "defect-photos: owner delete" on storage.objects;
create policy "defect-photos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'defect-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════
-- Done!
-- ═══════════════════════════════════════════════════════════════════
