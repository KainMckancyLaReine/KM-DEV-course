-- Paid access: the properties that matter, against a real Postgres.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

-- a third account: signed up, never paid
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'unpaid@km.dev', '{"name":"Unpaid"}')
on conflict do nothing;

-- ================================================== the account that has not paid
set role authenticated;
set test.uid = '44444444-4444-4444-8444-444444444444';

select case when public.has_access() = false
       then 'PASS' else 'FAIL' end || ' — a registered account without a payment has no access';
select case when (select count(*) from lessons) = 0
       then 'PASS' else 'FAIL' end || ' — it cannot read a single lesson row';
select case when (select count(*) from quiz_questions) = 0
       then 'PASS' else 'FAIL' end || ' — it cannot read a quiz question';
select case when (select count(*) from quiz_answers) = 0
       then 'PASS' else 'FAIL' end || ' — it cannot read a quiz answer';
select case when (select count(*) from prompts) = 0
       then 'PASS' else 'FAIL' end || ' — it cannot read the prompt library';
select case when (select count(*) from projects) = 0
       then 'PASS' else 'FAIL' end || ' — it cannot read a project brief';
select case when (select count(*) from levels) = 8
       then 'PASS' else 'FAIL' end || ' — but it can still see the shape of the programme';
select case when (access_state() ->> 'state') = 'registered'
       then 'PASS' else 'FAIL' end || ' — access_state calls it registered';
select case when jsonb_array_length(course_outline() -> 'levels') = 8
       then 'PASS' else 'FAIL' end || ' — the public outline still answers, with real counts';

do $$
begin
  perform submit_quiz((select id from quizzes where slug = 'foundation-assessment'), '{}'::jsonb);
  raise notice 'FAIL — an unpaid account could submit a quiz';
exception when others then
  raise notice '%', (case when sqlerrm like '%no access%' then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — grading refuses an unpaid account';
end $$;

do $$
begin
  insert into purchases (user_id, course_id, status, amount)
  values ('44444444-4444-4444-8444-444444444444',
          (select id from courses limit 1), 'paid', 0);
  raise notice 'FAIL — an account could write itself a paid purchase';
exception when others then
  raise notice 'PASS — an account cannot write itself a paid purchase';
end $$;

do $$
begin
  update purchases set status = 'paid';
  if found then
    raise notice 'FAIL — an account could mark a purchase paid';
  else
    raise notice 'PASS — an account cannot mark a purchase paid';
  end if;
exception when others then
  raise notice 'PASS — an account cannot mark a purchase paid';
end $$;

do $$
begin
  perform open_checkout('44444444-4444-4444-8444-444444444444', 'sess_forged');
  raise notice 'FAIL — open_checkout is callable from a session';
exception when insufficient_privilege then
  raise notice 'PASS — open_checkout is not callable from a session';
when others then
  raise notice '%', (case when sqlerrm like '%permission denied%'
                     then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — open_checkout is not callable from a session';
end $$;

do $$
begin
  perform record_payment('sess_forged', 'paid');
  raise notice 'FAIL — record_payment is callable from a session';
exception when others then
  raise notice '%', (case when sqlerrm like '%permission denied%'
                     then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — record_payment is not callable from a session';
end $$;

do $$
begin
  perform admin_set_access('44444444-4444-4444-8444-444444444444', 'paid');
  raise notice 'FAIL — a student could grant themselves access';
exception when others then
  raise notice '%', (case when sqlerrm like '%forbidden%' then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — admin_set_access refuses a student';
end $$;

do $$
begin
  perform admin_set_setting('course_price', '{"amount":1,"currency":"EUR"}'::jsonb);
  raise notice 'FAIL — a student could change the price';
exception when others then
  raise notice '%', (case when sqlerrm like '%forbidden%' then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — admin_set_setting refuses a student';
end $$;

select case when (select count(*) from settings where key = 'course_price') = 1
       then 'PASS' else 'FAIL' end || ' — the price is readable, because it is on a public page';
select case when (select count(*) from purchases) = 0
       then 'PASS' else 'FAIL' end || ' — it sees no purchase rows, not even its own absence';

reset role;

-- ====================================================== the payment completes
select open_checkout('44444444-4444-4444-8444-444444444444', 'cs_test_001') is not null;
select record_payment('cs_test_001', 'paid', 'pi_test_001', 'https://receipt', 175000, 'EUR') is not null;

set role authenticated;
set test.uid = '44444444-4444-4444-8444-444444444444';

select case when public.has_access()
       then 'PASS' else 'FAIL' end || ' — once the payment is recorded, the account has access';
select case when (select count(*) from lessons where published) = 14
       then 'PASS' else 'FAIL' end || ' — every published lesson is readable';
select case when (select count(*) from prompts) = 12
       then 'PASS' else 'FAIL' end || ' — the prompt library opens';
select case when (access_state() ->> 'state') = 'active_student'
       then 'PASS' else 'FAIL' end || ' — access_state calls it an active student';
select case when (access_state() -> 'purchase' ->> 'status') = 'paid'
       then 'PASS' else 'FAIL' end || ' — the account can see its own receipt';
select case when (select count(*) from lessons where not published) = 0
       then 'PASS' else 'FAIL' end || ' — a draft lesson stays closed even after paying';

reset role;

-- ================================================================ the refund
select record_payment('cs_test_001', 'refunded') is not null;
set role authenticated;
set test.uid = '44444444-4444-4444-8444-444444444444';
select case when public.has_access() = false
       then 'PASS' else 'FAIL' end || ' — a refund closes the course again';
select case when (select count(*) from lessons) = 0
       then 'PASS' else 'FAIL' end || ' — and the lessons go with it';
reset role;
select record_payment('cs_test_001', 'paid') is not null;

-- ============================================================== the price is real
select case when (select (value ->> 'amount')::int from settings where key = 'course_price') = 175000
       then 'PASS' else 'FAIL' end || ' — the price is 1750,00 EUR in minor units';

do $$
declare v jsonb;
begin
  select open_checkout('22222222-2222-4222-8222-222222222222', 'cs_test_002') into v;
  raise notice '%', (case when (v ->> 'amount')::int = 175000 then 'PASS' else 'FAIL' end)
    || ' — a checkout takes its amount from the database, not from the caller';
end $$;

do $$
begin
  perform open_checkout('44444444-4444-4444-8444-444444444444', 'cs_test_003');
  raise notice 'FAIL — an account that owns the course could buy it twice';
exception when others then
  raise notice '%', (case when sqlerrm like '%already owns%' then 'PASS' else 'FAIL(' || sqlerrm || ')' end)
    || ' — an account that owns the course cannot buy it twice';
end $$;

-- ==================================================================== as admin
set role authenticated;
set test.uid = '11111111-1111-4111-8111-111111111111';

select case when public.has_access()
       then 'PASS' else 'FAIL' end || ' — an administrator has access without paying';
select case when jsonb_array_length(admin_purchases()) >= 2
       then 'PASS' else 'FAIL' end || ' — admin_purchases lists the payments';
select case when (admin_overview() ->> 'purchases_paid')::int >= 1
       then 'PASS' else 'FAIL' end || ' — the overview counts paid purchases';
select case when (admin_overview() ->> 'revenue')::int >= 175000
       then 'PASS' else 'FAIL' end || ' — and adds up the revenue';
select case when (select u ->> 'purchase_status' from jsonb_array_elements(admin_users()) u
                   where u ->> 'email' = 'unpaid@km.dev') = 'paid'
       then 'PASS' else 'FAIL' end || ' — the user table shows each account''s access';
select case when (admin_set_setting('course_price',
         '{"amount":175000,"currency":"EUR","label":"One-time payment"}'::jsonb)) is not null
       then 'PASS' else 'FAIL' end || ' — an administrator can change the price';
select case when (admin_set_access('22222222-2222-4222-8222-222222222222', 'paid', 'bank transfer')) is not null
       then 'PASS' else 'FAIL' end || ' — an administrator can grant access by hand';

reset role;
