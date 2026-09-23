-- ═══════════════════════════════════════════════════════════════════
-- Road Defects Platform — Seed Data
-- Run this in Supabase SQL Editor AFTER 02-policies.sql
--
-- Note: profiles are created automatically when users sign up.
-- After running this, sign up 3 users in your app:
--   citizen@example.com    (role: citizen)
--   contractor@example.com (role: contractor)
--   admin@example.com      (role: admin)
-- Then run 04-link-users.sql to link them properly.
-- ═══════════════════════════════════════════════════════════════════

-- ─── CONTRACTORS ──────────────────────────────────────────────────
insert into public.contractors (id, name, abbr, crew_size, rating) values
  ('11111111-1111-1111-1111-111111111111', 'Central West Road Services', 'CW', 6, 4.8),
  ('22222222-2222-2222-2222-222222222222', 'Cabonne Civil',              'CC', 4, 4.4),
  ('33333333-3333-3333-3333-333333333333', 'Summit Asphalt',             'SA', 8, 4.9),
  ('44444444-4444-4444-4444-444444444444', 'Orange City Works Crew',     'OW', 5, 4.2)
on conflict (id) do nothing;

-- ─── DEFECTS ──────────────────────────────────────────────────────
-- Realistic Orange/Cabonne NSW dataset. Reporter left null; app assigns on demo login.
insert into public.defects (id, title, description, defect_type, severity, status, road, suburb, latitude, longitude, depth, width, votes, progress, contractor_id, reported_at) values
  ('RD-2041','Deep pothole in eastbound lane','Large pothole has opened in the eastbound lane approaching the Anson St lights. Water pooling in it after Tuesday rain. Two cars ahead of me hit it hard. Vehicle damage risk — this is on a bus route.','pothole','critical','progress','Summer St at Anson St','Orange',-33.28362,149.09902,'180 mm','0.9 m',23,60,'33333333-3333-3333-3333-333333333333', now() - interval '2 days'),
  ('RD-2038','Sealed edge collapsing on shoulder','Bitumen edge has broken away along a 22 metre stretch on the southern shoulder. Heavy truck traffic is widening it daily.','edge','high','assigned','Mitchell Hwy, 1.4 km W of Lucknow','Lucknow',-33.31290,149.16240,'90 mm','0.4 m × 22 m',11,0,'11111111-1111-1111-1111-111111111111', now() - interval '4 days'),
  ('RD-2033','Stormwater pooling across both lanes','The grate is blocked with leaf litter so runoff crosses the full carriageway after any decent rain. Visibility of the kerb line is gone at night.','flooding','high','pending','Ophir St near Warrendine St','Orange',-33.27698,149.09612,'—','12 m',17,0,null, now() - interval '1 day'),
  ('RD-2029','Longitudinal cracking, 40 m section','Series of parallel cracks running with the direction of travel. Widening since winter.','crack','medium','completed','Byng St near Lords Place','Orange',-33.28118,149.10140,'25 mm','40 m',6,100,'33333333-3333-3333-3333-333333333333', now() - interval '21 days'),
  ('RD-2026','Pothole cluster outside primary school','Three potholes in the drop-off zone. Parents are swerving into the opposing lane to avoid them at pickup time.','pothole','critical','assigned','McLachlan St at Kite St','Orange',-33.28902,149.09338,'140 mm','3 potholes',38,0,'11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('RD-2024','Give way sign knocked flat','Sign post sheared at the base, likely struck overnight. Intersection currently uncontrolled.','signage','critical','completed','Bathurst Rd at Hill St','Orange',-33.29470,149.11180,'—','—',14,100,'44444444-4444-4444-4444-444444444444', now() - interval '9 days'),
  ('RD-2021','Centre line completely worn away','Line marking is invisible in wet conditions along the whole stretch past the showground turnoff.','marking','medium','progress','Molong Rd, Orange to Borenore','Orange',-33.26830,149.07420,'—','2.1 km',9,35,'22222222-2222-2222-2222-222222222222', now() - interval '12 days'),
  ('RD-2018','Shallow pothole near roundabout','Minor surface loss on the approach to the roundabout.','pothole','low','completed','Peisley St at Kite St','Orange',-33.28770,149.10480,'40 mm','0.3 m',3,100,'33333333-3333-3333-3333-333333333333', now() - interval '27 days'),
  ('RD-2015','Pavement subsidence over trench','Old service trench has settled. Noticeable dip that bottoms out low vehicles.','subside','high','progress','Icely Rd near Coronation Dr','Orange',-33.29510,149.08130,'110 mm dip','6 m',12,80,'33333333-3333-3333-3333-333333333333', now() - interval '8 days'),
  ('RD-2012','Fallen branch blocking bike lane','Large gum branch down across the marked bike lane after Thursday winds.','debris','medium','completed','Forest Rd near Emmaville Ln','Orange',-33.27040,149.10810,'—','—',5,100,'44444444-4444-4444-4444-444444444444', now() - interval '15 days'),
  ('RD-2009','Crocodile cracking, full lane width','Interconnected cracking pattern suggesting base failure rather than a surface issue.','crack','high','assigned','Clergate Rd, 600 m N of Northern Distributor','Orange',-33.25310,149.09010,'30 mm','18 m',8,0,'11111111-1111-1111-1111-111111111111', now() - interval '6 days'),
  ('RD-2006','Drain grate sitting 60 mm proud','Grate has lifted above the road surface. Hazard for cyclists using the kerb lane.','flooding','medium','pending','Lords Place at Summer St','Orange',-33.28558,149.10270,'60 mm','0.6 m',4,0,null, now() - interval '1 day'),
  ('RD-2001','Pothole on heritage streetscape','Pothole outside the bakery. High pedestrian and tourist traffic on weekends.','pothole','medium','assigned','Pym St, Millthorpe','Millthorpe',-33.44520,149.19320,'75 mm','0.5 m',19,0,'22222222-2222-2222-2222-222222222222', now() - interval '5 days'),
  ('RD-1998','Washout after culvert overflow','Creek overtopped the culvert and scoured out the downstream shoulder. One lane effectively unusable.','flooding','critical','progress','Cargo Rd near Borenore Ck','Borenore',-33.27620,148.94510,'300 mm scour','4 m',16,25,'11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('RD-1995','Worn pedestrian crossing markings','Zebra stripes are about half worn through outside the medical centre.','marking','low','pending','March St at Sale St','Orange',-33.27912,149.09960,'—','—',7,0,null, now() - interval '2 days'),
  ('RD-1992','Gravel spill across intersection','Truck lost load of road base. Slippery for motorcycles.','debris','high','completed','Adelaide St, Blayney','Blayney',-33.53310,149.25340,'—','—',6,100,'22222222-2222-2222-2222-222222222222', now() - interval '11 days'),
  ('RD-1989','Sunken manhole in wheel path','Manhole cover sits well below the resurfaced pavement.','subside','medium','assigned','Woodward St near Summer St','Orange',-33.28812,149.10010,'50 mm','0.7 m',5,0,'44444444-4444-4444-4444-444444444444', now() - interval '7 days')
on conflict (id) do nothing;

-- ─── REPAIR UPDATES ───────────────────────────────────────────────
insert into public.repair_updates (defect_id, action, note, progress, actor_role, created_at) values
  ('RD-2041','Report submitted','Photo and location captured on Summer St, eastbound lane.',0,'citizen', now() - interval '2 days'),
  ('RD-2041','Triaged as Critical','Bus route and vehicle damage risk. 24 hour SLA applied. Temporary cold-mix authorised.',0,'admin', now() - interval '2 days'),
  ('RD-2041','Assigned to crew','Crew 2 scheduled for the 6am window to avoid peak traffic. Traffic control booked.',10,'contractor', now() - interval '1 day'),
  ('RD-2041','Cold-mix patch placed','Interim patch down and compacted. Hazard removed. Permanent hot-mix repair scheduled Thursday once the saw cut is done.',60,'contractor', now() - interval '19 hours'),
  ('RD-2029','Report submitted','Cracking along Byng St.',0,'citizen', now() - interval '21 days'),
  ('RD-2029','Triaged as Medium','Scheduled into the crack-sealing program.',0,'admin', now() - interval '19 days'),
  ('RD-2029','Assigned','Bundled with three nearby jobs.',15,'contractor', now() - interval '14 days'),
  ('RD-2029','Crack sealing underway','Routed and sealed 28 of 40 metres.',65,'contractor', now() - interval '9 days'),
  ('RD-2029','Repair complete','Full 40 m sealed and swept. Site cleared.',100,'contractor', now() - interval '6 days'),
  ('RD-2029','Inspected and closed','Passed post-works inspection. Defect closed.',100,'admin', now() - interval '5 days');

-- ═══════════════════════════════════════════════════════════════════
-- Done! Contractors + 17 defects + repair updates loaded.
-- Next: sign up demo users in the app, then run 04-link-users.sql
-- ═══════════════════════════════════════════════════════════════════
