-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — fix: "violates check constraint defects_description_len"
--
-- Run this ONCE in the Supabase SQL Editor. Keeps all your data.
-- Older short reports can be assigned/closed again; new reports are still checked.
-- ═══════════════════════════════════════════════════════════════════

-- Title/description minimums. A trigger rather than a CHECK constraint, because a CHECK
-- (even NOT VALID) re-tests every row on any update — older short reports could then
-- never be assigned or closed. This only checks new reports and edited text.
alter table public.defects drop constraint if exists defects_title_len;
alter table public.defects drop constraint if exists defects_description_len;

create or replace function public.check_report_text()
returns trigger as $$
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title then
    if char_length(trim(new.title)) not between 8 and 100 then
      raise exception 'Title must be 8 to 100 characters.';
    end if;
  end if;
  if tg_op = 'INSERT' or new.description is distinct from old.description then
    if char_length(trim(new.description)) not between 20 and 2000 then
      raise exception 'Description must be 20 to 2000 characters.';
    end if;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_defects_check_text on public.defects;
create trigger trg_defects_check_text before insert or update on public.defects
  for each row execute function public.check_report_text();
