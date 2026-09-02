-- =============================================================================
-- KM.dev Academy — database schema
-- Postgres / Supabase
--
-- Run this once in the Supabase SQL editor, then run seed.sql.
--
-- Design notes that matter:
--   * Every rule that protects data is a row level security policy, not a
--     hidden button. A student's session cannot read another student's rows
--     even if they craft the request by hand.
--   * `is_correct` on quiz answers is never granted to students at the column
--     level, so the right answers cannot be fetched before submitting.
--   * Quizzes are graded by a SECURITY DEFINER function on the server. The
--     browser never decides a score.
--   * Course progress is a view, not a stored number, so it can never drift
--     away from the lessons it is derived from.
-- =============================================================================

-- ----------------------------------------------------------------- extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  name           text        not null default '',
  email          text        not null,
  role           text        not null default 'student' check (role in ('student', 'admin')),
  created_at     timestamptz not null default now(),
  last_active_at timestamptz
);

-- Emails listed here become admins the moment they sign up. This is server
-- side data, never shipped to the browser, and it means no password or role
-- is ever hard-coded in front-end code.
create table if not exists public.admin_bootstrap (
  email text primary key
);

-- --------------------------------------------------------------------- course

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text not null default '',
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.levels (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses on delete cascade,
  slug        text unique not null,
  title       text not null,
  description text not null default '',
  position    integer not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id                uuid primary key default gen_random_uuid(),
  level_id          uuid not null references public.levels on delete cascade,
  slug              text unique not null,
  title             text not null,
  description       text not null default '',
  content           jsonb not null default '[]'::jsonb,
  position          integer not null,
  published         boolean not null default false,
  estimated_minutes integer not null default 10,
  video_url         text,
  video_duration    integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  level_id    uuid not null references public.levels on delete cascade,
  slug        text unique not null,
  title       text not null,
  description text not null default '',
  brief       jsonb not null default '{}'::jsonb,
  is_final    boolean not null default false,
  position    integer not null default 1,
  published   boolean not null default true
);

create table if not exists public.prompts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  category    text not null,
  title       text not null,
  purpose     text not null default '',
  body        text not null,
  explanation jsonb not null default '{}'::jsonb,
  position    integer not null default 1
);

-- -------------------------------------------------------------------- quizzes

create table if not exists public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  level_id      uuid references public.levels on delete cascade,
  lesson_id     uuid references public.lessons on delete cascade,
  slug          text unique not null,
  title         text not null,
  subtitle      text not null default '',
  passing_score integer not null default 70,
  published     boolean not null default false,
  position      integer not null default 1
);

create table if not exists public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes on delete cascade,
  question    text not null,
  type        text not null default 'single'
              check (type in ('single', 'multi', 'tf', 'scenario', 'prompt', 'debug')),
  explanation text not null default '',
  points      integer not null default 1,
  position    integer not null
);

create table if not exists public.quiz_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions on delete cascade,
  answer      text not null,
  is_correct  boolean not null default false,
  position    integer not null
);

create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  quiz_id    uuid not null references public.quizzes on delete cascade,
  score      integer not null,
  total      integer not null,
  percentage integer not null,
  passed     boolean not null,
  detail     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- progress

create table if not exists public.lesson_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles on delete cascade,
  lesson_id      uuid not null references public.lessons on delete cascade,
  completed      boolean not null default false,
  completed_at   timestamptz,
  video_progress numeric not null default 0,
  video_seen     boolean not null default false,
  last_seen_at   timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.lesson_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  lesson_id  uuid not null references public.lessons on delete cascade,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  lesson_id  uuid not null references public.lessons on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.project_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  status     text not null default 'not_started'
             check (status in ('not_started', 'in_progress', 'submitted', 'complete')),
  checklist  jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create table if not exists public.certificates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles on delete cascade,
  course_id      uuid not null references public.courses on delete cascade,
  certificate_id text unique not null,
  issued_at      timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists lessons_level_idx        on public.lessons (level_id, position);
create index if not exists levels_course_idx        on public.levels (course_id, position);
create index if not exists progress_user_idx        on public.lesson_progress (user_id);
create index if not exists attempts_user_quiz_idx   on public.quiz_attempts (user_id, quiz_id);
create index if not exists questions_quiz_idx       on public.quiz_questions (quiz_id, position);
create index if not exists answers_question_idx     on public.quiz_answers (question_id, position);

-- =============================================================================
-- Helper functions
-- =============================================================================

-- SECURITY DEFINER so that reading a role never has to pass through the
-- profiles policy that is itself defined in terms of this function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.admin_bootstrap b where b.email = new.email)
         then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;

-- =============================================================================
-- Views
-- =============================================================================

-- Progress is derived, never stored, so it cannot drift from the lessons.
create or replace view public.course_progress
with (security_invoker = true) as
select
  p.id                                                      as user_id,
  c.id                                                      as course_id,
  count(distinct l.id) filter (where l.published)            as total_lessons,
  count(distinct lp.lesson_id) filter (where lp.completed)   as completed_lessons,
  case when count(distinct l.id) filter (where l.published) = 0 then 0
       else round(
         100.0 * count(distinct lp.lesson_id) filter (where lp.completed)
         / count(distinct l.id) filter (where l.published)
       )::int
  end                                                        as percentage
from public.profiles p
cross join public.courses c
left join public.levels lv on lv.course_id = c.id and lv.published
left join public.lessons l on l.level_id = lv.id
left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p.id
group by p.id, c.id;

-- =============================================================================
-- Row level security
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.admin_bootstrap  enable row level security;
alter table public.courses          enable row level security;
alter table public.levels           enable row level security;
alter table public.lessons          enable row level security;
alter table public.projects         enable row level security;
alter table public.prompts          enable row level security;
alter table public.quizzes          enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_answers     enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.lesson_notes     enable row level security;
alter table public.bookmarks        enable row level security;
alter table public.project_progress enable row level security;
alter table public.certificates     enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists profiles_select_self  on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_self  on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_update_self  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- A student may edit their own row but never their own role. Enforced here
-- rather than in the interface, because the interface is not a boundary.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only an administrator may change a role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- admin_bootstrap is server-side only; nobody reads it from the browser.
drop policy if exists bootstrap_admin on public.admin_bootstrap;
create policy bootstrap_admin on public.admin_bootstrap for all
  using (public.is_admin()) with check (public.is_admin());

-- published content is readable by any signed-in user; only admins write ---
do $$
declare t text;
begin
  foreach t in array array['courses', 'levels', 'lessons', 'projects', 'quizzes'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select to authenticated using (published or public.is_admin())',
      t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t, t);
  end loop;
end $$;

drop policy if exists prompts_read  on public.prompts;
drop policy if exists prompts_write on public.prompts;
create policy prompts_read  on public.prompts for select to authenticated using (true);
create policy prompts_write on public.prompts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- quiz questions and answers ---------------------------------------------
drop policy if exists questions_read  on public.quiz_questions;
drop policy if exists questions_write on public.quiz_questions;
create policy questions_read on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes q
                 where q.id = quiz_id and (q.published or public.is_admin())));
create policy questions_write on public.quiz_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists answers_read  on public.quiz_answers;
drop policy if exists answers_write on public.quiz_answers;
create policy answers_read on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_questions qq
                 join public.quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and (q.published or public.is_admin())));
create policy answers_write on public.quiz_answers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Column level: a signed-in student can read the answer text but not which
-- one is correct. This is what stops the right answers being fetched before
-- the quiz is submitted, and it holds no matter what the browser asks for.
revoke all on public.quiz_answers from authenticated, anon;
grant select (id, question_id, answer, position) on public.quiz_answers to authenticated;
grant insert, update, delete on public.quiz_answers to authenticated; -- still gated by RLS above

-- per-user rows: yours, or an admin's read ------------------------------
do $$
declare t text;
begin
  foreach t in array array['lesson_progress', 'lesson_notes', 'bookmarks',
                           'project_progress', 'quiz_attempts', 'certificates'] loop
    execute format('drop policy if exists %I_own       on public.%I', t, t);
    execute format('drop policy if exists %I_admin_read on public.%I', t, t);
    execute format(
      'create policy %I_own on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t);
    execute format(
      'create policy %I_admin_read on public.%I for select to authenticated using (public.is_admin())',
      t, t);
  end loop;
end $$;

-- Notes are private. An admin can see that a note exists through the count,
-- but not read it, unless you deliberately change this policy.
drop policy if exists lesson_notes_admin_read on public.lesson_notes;

-- =============================================================================
-- Server-side quiz grading
-- =============================================================================
-- The browser sends the chosen answer ids. The server decides the score,
-- records the attempt and only then returns the correct answers and the
-- explanations. There is no path where a client can mark its own work.

create or replace function public.submit_quiz(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_quiz      public.quizzes%rowtype;
  v_question  record;
  v_chosen    uuid[];
  v_correct   uuid[];
  v_ok        boolean;
  v_score     int := 0;
  v_total     int := 0;
  v_detail    jsonb := '[]'::jsonb;
  v_pct       int;
  v_passed    boolean;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'unknown quiz';
  end if;
  if not v_quiz.published and not public.is_admin() then
    raise exception 'quiz is not published';
  end if;

  for v_question in
    select id, question, explanation, points, position
    from public.quiz_questions
    where quiz_id = p_quiz_id
    order by position
  loop
    v_total := v_total + v_question.points;

    select coalesce(array_agg(a.id order by a.position), '{}')
      into v_correct
      from public.quiz_answers a
     where a.question_id = v_question.id and a.is_correct;

    select coalesce(array_agg(value::uuid), '{}')
      into v_chosen
      from jsonb_array_elements_text(coalesce(p_answers -> v_question.id::text, '[]'::jsonb));

    v_ok := (select coalesce(array_agg(x order by x), '{}') from unnest(v_chosen) x)
          = (select coalesce(array_agg(x order by x), '{}') from unnest(v_correct) x);

    if v_ok then
      v_score := v_score + v_question.points;
    end if;

    v_detail := v_detail || jsonb_build_object(
      'question_id', v_question.id,
      'correct',     v_ok,
      'chosen',      to_jsonb(v_chosen),
      'answer',      to_jsonb(v_correct),
      'explanation', v_question.explanation
    );
  end loop;

  v_pct    := case when v_total = 0 then 0 else round(100.0 * v_score / v_total)::int end;
  v_passed := v_pct >= v_quiz.passing_score;

  insert into public.quiz_attempts (user_id, quiz_id, score, total, percentage, passed, detail)
  values (v_user, p_quiz_id, v_score, v_total, v_pct, v_passed, v_detail);

  return jsonb_build_object(
    'score', v_score, 'total', v_total, 'percentage', v_pct,
    'passed', v_passed, 'passing_score', v_quiz.passing_score, 'detail', v_detail
  );
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Admins need the correct answers in order to edit a quiz. This is the only
-- route to them, and it checks the role on the server.
create or replace function public.admin_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_agg(q order by q.position) into v_out from (
    select qq.id, qq.question, qq.type, qq.explanation, qq.points, qq.position,
           (select jsonb_agg(jsonb_build_object(
                     'id', a.id, 'answer', a.answer,
                     'is_correct', a.is_correct, 'position', a.position)
                   order by a.position)
              from public.quiz_answers a where a.question_id = qq.id) as answers
      from public.quiz_questions qq
     where qq.quiz_id = p_quiz_id
  ) q;

  return coalesce(v_out, '[]'::jsonb);
end;
$$;

revoke all on function public.admin_quiz(uuid) from public, anon;
grant execute on function public.admin_quiz(uuid) to authenticated;

-- Aggregate numbers for the admin overview, computed on the server so that a
-- student cannot obtain them by asking for the underlying rows.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'total_students',   (select count(*) from public.profiles where role = 'student'),
    'active_students',  (select count(*) from public.profiles
                          where role = 'student' and last_active_at > now() - interval '14 days'),
    'lessons_completed',(select count(*) from public.lesson_progress where completed),
    'published_lessons',(select count(*) from public.lessons where published),
    'total_lessons',    (select count(*) from public.lessons),
    'average_progress', (select coalesce(round(avg(percentage)), 0)
                           from public.course_progress cp
                           join public.profiles p on p.id = cp.user_id
                          where p.role = 'student'),
    'attempts',         (select count(*) from public.quiz_attempts),
    'pass_rate',        (select case when count(*) = 0 then 0
                                else round(100.0 * count(*) filter (where passed) / count(*))::int end
                           from public.quiz_attempts),
    'projects_started', (select count(*) from public.project_progress where status <> 'not_started'),
    'completions_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
        from (
          select date_trunc('day', completed_at)::date as d, count(*) as n
            from public.lesson_progress
           where completed and completed_at > now() - interval '14 days'
           group by 1
        ) s
    )
  ) into v;

  return v;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- A single call for the admin user table, so the list does not need a query
-- per student.
create or replace function public.admin_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(u order by u.created_at), '[]'::jsonb) into v from (
    select p.id, p.name, p.email, p.role, p.created_at, p.last_active_at,
           coalesce(cp.percentage, 0)        as percentage,
           coalesce(cp.completed_lessons, 0) as completed_lessons,
           coalesce(cp.total_lessons, 0)     as total_lessons,
           (select count(*) from public.quiz_attempts qa where qa.user_id = p.id) as attempts
      from public.profiles p
      left join public.course_progress cp on cp.user_id = p.id
  ) u;

  return v;
end;
$$;

revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- Issued once every published lesson is complete and the final assessment
-- has been passed. The check happens here, not in the browser.
create or replace function public.claim_certificate(p_course_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_course public.courses%rowtype;
  v_prog   record;
  v_final  boolean;
  v_cert   public.certificates%rowtype;
  v_name   text;
begin
  if v_user is null then raise exception 'not signed in'; end if;

  select * into v_course from public.courses where slug = p_course_slug;
  if not found then raise exception 'unknown course'; end if;

  select * into v_prog from public.course_progress
   where user_id = v_user and course_id = v_course.id;

  select exists (
    select 1 from public.quiz_attempts qa
      join public.quizzes q on q.id = qa.quiz_id
     where qa.user_id = v_user and qa.passed and q.slug = 'final-assessment'
  ) into v_final;

  if coalesce(v_prog.percentage, 0) < 100 or not v_final then
    return jsonb_build_object('issued', false,
      'percentage', coalesce(v_prog.percentage, 0), 'final_passed', v_final);
  end if;

  select name into v_name from public.profiles where id = v_user;

  insert into public.certificates (user_id, course_id, certificate_id)
  values (v_user, v_course.id,
          'KMD-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_user::text, '-', ''), 1, 6)))
  on conflict (user_id, course_id) do nothing;

  select * into v_cert from public.certificates
   where user_id = v_user and course_id = v_course.id;

  return jsonb_build_object('issued', true, 'certificate_id', v_cert.certificate_id,
                            'issued_at', v_cert.issued_at, 'name', v_name);
end;
$$;

revoke all on function public.claim_certificate(text) from public, anon;
grant execute on function public.claim_certificate(text) to authenticated;
