-- ═══════════════════════════════════════════════════════════════════
-- RoadFix — Council-Account.sql: (re)create the council admin account
--
-- Use this when you can't sign in as council (forgotten password,
-- "Invalid login credentials", or the account is missing).
--
-- 1. Change the password on the line marked  ← CHANGE THIS
-- 2. Paste the whole file into Supabase SQL Editor and click "Run"
-- 3. Sign in with council@gmail.com and that password
--
-- It deletes the old council@gmail.com account (if there is one) and
-- creates a new, confirmed one that is already the council admin.
-- Reports and other accounts are NOT touched.
--
-- Run Database.sql first on a new project — this file needs its tables.
-- Keep the email as council@gmail.com: Database.sql looks for it.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  new_email    text := 'council@gmail.com';
  new_password text := 'Council@2026';          -- ← CHANGE THIS
  new_id       uuid := gen_random_uuid();
begin
  if char_length(new_password) < 6 then
    raise exception 'The password must be at least 6 characters.';
  end if;

  -- 1. Remove the old council account (and its profile)
  delete from auth.users where lower(email) = lower(new_email);

  -- 2. Create the new account, already confirmed
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', new_email,
          extensions.crypt(new_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"name":"Council"}', now(), now(), '', '', '', '');

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (new_id::text, new_id, jsonb_build_object('sub', new_id::text, 'email', new_email, 'email_verified', true),
          'email', now(), now(), now());

  -- 3. Make it the council admin
  update public.profiles set role = 'admin', contractor_id = null where id = new_id;
end $$;

-- Check: should show one row — council@gmail.com | admin
select u.email, p.role
  from auth.users u
  join public.profiles p on p.id = u.id
 where u.email = 'council@gmail.com';
