-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Platform — Link Demo Users to Roles
--
-- Run this in Supabase SQL Editor AFTER you have signed up three
-- accounts through the app:
--
--   1. citizen@example.com     / demo1234
--   2. contractor@example.com  / demo1234
--   3. admin@example.com       / demo1234
--
-- This script promotes them to the right role and assigns some
-- existing defects so the dashboards have real data.
-- ═══════════════════════════════════════════════════════════════════

-- Promote roles
update public.profiles
   set role = 'admin', name = 'Helen Osei', suburb = 'Orange City Council'
 where email = 'admin@example.com';

update public.profiles
   set role = 'contractor',
       name = 'Dev Raghunath',
       suburb = 'Summit Asphalt',
       contractor_id = '33333333-3333-3333-3333-333333333333'
 where email = 'contractor@example.com';

update public.profiles
   set role = 'citizen', name = 'Alicia Moreau', suburb = 'Orange NSW 2800'
 where email = 'citizen@example.com';

-- Set the citizen as reporter on several defects so "My reports" has data
update public.defects
   set reported_by = (select id from public.profiles where email = 'citizen@example.com')
 where id in ('RD-2041','RD-2033','RD-2029','RD-2021','RD-2018','RD-2012','RD-2006','RD-1995','RD-1989');

-- Confirm
select email, name, role from public.profiles order by role, email;
select 'Defects owned by citizen:' as label, count(*) as n
  from public.defects
 where reported_by = (select id from public.profiles where email = 'citizen@example.com');

-- ═══════════════════════════════════════════════════════════════════
-- Done! Log in as any of the three accounts to see the right dashboard.
-- ═══════════════════════════════════════════════════════════════════
