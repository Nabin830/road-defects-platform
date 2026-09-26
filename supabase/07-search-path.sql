-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — pin search_path on every function (security hardening)
--
-- Run ONCE in the Supabase SQL Editor. Keeps all your data.
-- Fixes Supabase's "Function Search Path Mutable" security warning: every
-- RoadFix function now looks names up in the public schema only, so nobody
-- can trick a function into using a look-alike table or function.
-- (00-all-in-one.sql already includes this.)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- skip extension functions
       and not coalesce(p.proconfig::text, '') like '%search_path%'
  loop
    execute format('alter function %s set search_path = public', f.sig);
    raise notice 'pinned search_path on %', f.sig;
  end loop;
end $$;
