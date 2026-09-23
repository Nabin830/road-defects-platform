-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Platform — Followers ("Follow updates")
-- Run this in Supabase SQL Editor AFTER 02-policies.sql
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.followers (
  defect_id  text not null references public.defects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (defect_id, user_id)
);

create index if not exists idx_followers_user on public.followers(user_id);

alter table public.followers enable row level security;

drop policy if exists "Followers: users manage their own" on public.followers;
create policy "Followers: users manage their own"
  on public.followers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- Note: this table only *records* the follow relationship. Sending an
-- actual email when a followed defect changes status requires a
-- Supabase Edge Function wired to a transactional email provider
-- (e.g. Resend/Postmark) triggered from repair_updates inserts — that
-- needs its own API key and is not included here.
-- ═══════════════════════════════════════════════════════════════════
