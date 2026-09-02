-- Exercises the security properties of db/schema.sql against a real Postgres.
-- Every check prints PASS or FAIL; nothing here is asserted by inspection.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

-- two accounts, created the way Supabase creates them
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'kain@km.dev',  '{"name":"Kain"}'),
  ('22222222-2222-4222-8222-222222222222', 'userb@km.dev', '{"name":"User B"}'),
  ('33333333-3333-4333-8333-333333333333', 'kkain25@gmail.com', '{"name":"Kain"}')
on conflict do nothing;

select case when (select role from profiles where email = 'kain@km.dev') = 'admin'
       then 'PASS' else 'FAIL' end || ' — the bootstrap table makes kain@km.dev an admin on sign-up';
select case when (select role from profiles where email = 'kkain25@gmail.com') = 'admin'
       then 'PASS' else 'FAIL' end || ' — the second bootstrap address is an admin on sign-up too';
select case when (select role from profiles where email = 'userb@km.dev') = 'student'
       then 'PASS' else 'FAIL' end || ' — everyone else is created as a student';

-- The Dutch columns must actually carry the translation, or the interface
-- silently falls back to English and nobody notices until a reader does.
select case when (select count(*) from lessons where published and content_nl <> '[]'::jsonb) = 14
       then 'PASS' else 'FAIL' end || ' — every published lesson has Dutch content';
select case when (select count(*) from lessons where published and title_nl = '') = 0
       then 'PASS' else 'FAIL' end || ' — every published lesson has a Dutch title';
select case when (select count(*) from levels where title_nl = '') = 0
       then 'PASS' else 'FAIL' end || ' — every level has a Dutch title';
select case when (select count(*) from prompts where body_nl = '' or title_nl = '') = 0
       then 'PASS' else 'FAIL' end || ' — every prompt is translated';
select case when (select count(*) from projects where brief_nl = '{}'::jsonb) = 0
       then 'PASS' else 'FAIL' end || ' — every project brief is translated';
select case when (select count(*) from quiz_questions where question_nl = '') = 0
       then 'PASS' else 'FAIL' end || ' — every assessment question is translated';
select case when (select count(*) from quiz_answers where answer_nl = '') = 0
       then 'PASS' else 'FAIL' end || ' — every assessment answer is translated';

-- The course is paid for now (db/phase15.sql). These checks were written when
-- it was free, and they are about progress, grading and roles rather than
-- about entitlement — so give both accounts a real purchase and let them go on
-- testing what they were written to test. Paid access has its own suite.
do $$
begin
  if to_regclass('public.purchases') is not null then
    insert into public.purchases (user_id, course_id, status, amount, currency, provider, paid_at)
    select u.id, (select id from public.courses limit 1), 'paid', 175000, 'EUR', 'test', now()
      from (values ('11111111-1111-4111-8111-111111111111'::uuid),
                   ('22222222-2222-4222-8222-222222222222'::uuid),
                   ('33333333-3333-4333-8333-333333333333'::uuid)) as u(id)
     where not exists (select 1 from public.purchases p where p.user_id = u.id);
  end if;
end $$;

-- some progress for each account, inserted as the owner (bypasses RLS by design)
insert into lesson_progress (user_id, lesson_id, completed, completed_at)
select '22222222-2222-4222-8222-222222222222', id, true, now()
from lessons where published order by position limit 3
on conflict do nothing;
insert into lesson_progress (user_id, lesson_id, completed, completed_at)
select '11111111-1111-4111-8111-111111111111', id, true, now()
from lessons where published order by position limit 1
on conflict do nothing;

-- ============================================================ as the student
set role authenticated;
set test.uid = '22222222-2222-4222-8222-222222222222';

select case when (select count(*) from lesson_progress) = 3
       then 'PASS' else 'FAIL (' || (select count(*) from lesson_progress) || ' rows)' end
       || ' — a student sees only their own progress rows';

select case when (select count(*) from profiles) = 1
       then 'PASS' else 'FAIL (' || (select count(*) from profiles) || ' rows)' end
       || ' — a student sees only their own profile';

-- the correct answers must not be selectable
select case when (select count(*) from quiz_answers) > 0
       then 'PASS' else 'FAIL' end || ' — a student can read the answer text';

do $$
declare ok boolean := false;
begin
  begin
    perform is_correct from quiz_answers limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) ||
    ' — a student cannot select is_correct, so the answers cannot be fetched before submitting';
end $$;

do $$
declare ok boolean := false;
begin
  begin perform admin_users(); exception when others then ok := true; end;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) || ' — admin_users() refuses a student';
end $$;

do $$
declare ok boolean := false;
begin
  begin perform admin_overview(); exception when others then ok := true; end;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) || ' — admin_overview() refuses a student';
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update profiles set role = 'admin' where id = auth.uid();
  exception when others then ok := true;
  end;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) || ' — a student cannot promote themselves';
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update lessons set title = 'hijacked' where slug = 'context';
    if not found then ok := true; end if;
  exception when others then ok := true;
  end;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) || ' — a student cannot edit a lesson';
end $$;

-- grading happens on the server and returns the explanations only afterwards
do $$
declare
  v_quiz uuid;
  v_ans  jsonb := '{}'::jsonb;
  r      record;
  res    jsonb;
begin
  select id into v_quiz from quizzes where slug = 'foundation-assessment';
  for r in select qq.id as qid,
                  (select a.id from quiz_answers a where a.question_id = qq.id order by a.position limit 1) as first_answer
           from quiz_questions qq where qq.quiz_id = v_quiz
  loop
    v_ans := v_ans || jsonb_build_object(r.qid::text, jsonb_build_array(r.first_answer));
  end loop;

  res := submit_quiz(v_quiz, v_ans);
  raise notice '%', (case when (res->>'total')::int = 10 then 'PASS' else 'FAIL' end) ||
    ' — submit_quiz grades all ten questions (scored ' || (res->>'score') || '/' || (res->>'total') || ')';
  raise notice '%', (case when jsonb_array_length(res->'detail') = 10 then 'PASS' else 'FAIL' end) ||
    ' — the explanations come back with the result, not before';
  raise notice '%', (case when (select count(*) from quiz_attempts where user_id = auth.uid()) = 1
    then 'PASS' else 'FAIL' end) || ' — the attempt is recorded against the account';
end $$;

select case when (select percentage from course_progress
                  where user_id = auth.uid()
                    and course_id = (select id from courses where slug = 'ai-web-developer')) = 21
       then 'PASS' else 'FAIL (' || coalesce((select percentage::text from course_progress
             where user_id = auth.uid()), 'null') || ')' end
       || ' — course progress is derived from the lessons, not stored';

reset role;

-- ============================================================== as the admin
set role authenticated;
set test.uid = '11111111-1111-4111-8111-111111111111';

select case when (select count(*) from profiles) = 3
       then 'PASS' else 'FAIL' end || ' — an admin sees every profile';
select case when jsonb_array_length(admin_users()) = 3
       then 'PASS' else 'FAIL' end || ' — admin_users() works for an admin';
select case when (admin_overview() ->> 'total_students')::int = 1
       then 'PASS' else 'FAIL' end || ' — admin_overview() counts students only';
select case when jsonb_array_length(admin_quiz((select id from quizzes where slug = 'foundation-assessment'))) = 10
       then 'PASS' else 'FAIL' end || ' — an admin can read the questions with their correct answers';

do $$
declare ok boolean := false;
begin
  update lessons set title = title where slug = 'context';
  ok := found;
  raise notice '%', (case when ok then 'PASS' else 'FAIL' end) || ' — an admin can edit a lesson';
end $$;

select case when (claim_certificate('ai-web-developer') ->> 'issued') = 'false'
       then 'PASS' else 'FAIL' end || ' — the certificate is refused before the course is finished';

reset role;
