-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — add council work orders (what to do + fix-by date)
--
-- Run this ONCE in the Supabase SQL Editor on an existing database.
-- It keeps all your data (unlike 00-all-in-one.sql, which wipes it).
-- ═══════════════════════════════════════════════════════════════════

alter table public.defects add column if not exists work_instructions text;  -- what the contractor must do
alter table public.defects add column if not exists due_at timestamptz;       -- council-set fix-by date

-- Only council can set the work order and fix-by date (same guard as verification)
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
