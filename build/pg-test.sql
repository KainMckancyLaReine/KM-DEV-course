-- Exercises the security properties of db/schema.sql against a real Postgres.
-- Every check prints PASS or FAIL; nothing here is asserted by inspection.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

-- two accounts, created the way Supabase creates them
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'kain@km.dev',  '{"name":"Kain"}'),
  ('22222222-2222-4222-8222-222222222222', 'userb@km.dev', '{"name":"User B"}')
on conflict do nothing;

select case when (select role from profiles where email = 'kain@km.dev') = 'admin'
       then 'PASS' else 'FAIL' end || ' — the bootstrap table makes kain@km.dev an admin on sign-up';
select case when (select role from profiles where email = 'userb@km.dev') = 'student'
       then 'PASS' else 'FAIL' end || ' — everyone else is created as a student';

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

select case when (select count(*) from profiles) = 2
       then 'PASS' else 'FAIL' end || ' — an admin sees every profile';
select case when jsonb_array_length(admin_users()) = 2
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
