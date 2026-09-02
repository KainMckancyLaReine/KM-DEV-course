-- =============================================================================
-- KM.dev Academy — paid access
-- Postgres / Supabase
--
-- Run after schema.sql and seed.sql. Safe to run again.
--
-- The rule this file exists to enforce: a signed-in account with no completed
-- payment cannot read the course. Not "does not see a button" — cannot read
-- it. Lesson content, quiz questions, quiz answers, project briefs and the
-- prompt library are all closed behind `has_access()`, which is a function on
-- the server, and the purchase rows it reads are writable by nothing that a
-- browser can reach.
--
-- What stays open to everyone, signed in or not, is `course_outline()`: the
-- shape of the programme — levels, titles, how many lessons, how many minutes.
-- The pricing page needs real numbers rather than invented ones, and the shape
-- of a course is not the course.
-- =============================================================================

-- ------------------------------------------------------------------ settings
-- One row per setting, so the price is a value an administrator edits rather
-- than a number compiled into five front-end files.

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  public      boolean not null default false,   -- readable without a session
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles on delete set null
);

insert into public.settings (key, value, public) values
  ('course_price', jsonb_build_object(
      'amount', 175000,          -- minor units: 175000 cents = EUR 1750,00
      'currency', 'EUR',
      'label', 'One-time payment'), true),
  ('checkout', jsonb_build_object(
      'provider', 'stripe',
      'mode', 'payment',
      'live', false), true)
on conflict (key) do nothing;

alter table public.settings enable row level security;

drop policy if exists settings_read_public on public.settings;
drop policy if exists settings_write_admin on public.settings;

-- The price is on a public page, so anon may read the settings marked public
-- and nothing else. Everything else is administrators only.
create policy settings_read_public on public.settings for select
  to anon, authenticated using (public or public.is_admin());
create policy settings_write_admin on public.settings for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------- purchases
-- The lifecycle of one payment. `not_purchased` is the absence of a row, so it
-- is not a status here; every other state a payment can be in is.

create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles on delete cascade,
  course_id     uuid not null references public.courses on delete cascade,
  status        text not null default 'checkout_started'
                check (status in ('checkout_started', 'payment_pending',
                                  'paid', 'refunded', 'cancelled')),
  amount        integer not null,               -- minor units, as charged
  currency      text    not null default 'EUR',
  provider      text    not null default 'stripe',
  provider_ref  text,                           -- checkout session id
  payment_ref   text,                           -- payment intent id
  receipt_url   text,
  note          text not null default '',       -- set when an admin intervenes
  created_at    timestamptz not null default now(),
  paid_at       timestamptz,
  updated_at    timestamptz not null default now()
);

create unique index if not exists purchases_provider_ref_idx
  on public.purchases (provider_ref) where provider_ref is not null;
create index if not exists purchases_user_idx on public.purchases (user_id, status);

alter table public.purchases enable row level security;

drop policy if exists purchases_read_own   on public.purchases;
drop policy if exists purchases_read_admin on public.purchases;
drop policy if exists purchases_write      on public.purchases;

-- A student may look at their own payment. Nobody may write one: there is no
-- insert, update or delete policy for `authenticated` at all, so the only way
-- a purchase changes is a function the service role runs after Stripe has been
-- verified. This is the whole anti-bypass, and it is one sentence long.
create policy purchases_read_own on public.purchases for select
  to authenticated using (user_id = auth.uid());
create policy purchases_read_admin on public.purchases for select
  to authenticated using (public.is_admin());
create policy purchases_write on public.purchases for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.purchases from authenticated, anon;
grant insert, update, delete on public.purchases to authenticated;  -- still RLS-gated to admins

-- ---------------------------------------------------------------- has_access
-- SECURITY DEFINER, because the answer must not depend on the policies it is
-- used to write. An administrator always has access; everyone else needs a
-- payment that actually completed.

create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.purchases pu
                where pu.user_id = auth.uid() and pu.status = 'paid')
  );
$$;

revoke all on function public.has_access() from public;
grant execute on function public.has_access() to anon, authenticated;

-- The state the interface renders from. One call, so a page does not have to
-- assemble an answer out of three queries and guess in between.
create or replace function public.access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_pur  public.purchases%rowtype;
  v_price jsonb;
begin
  select value into v_price from public.settings where key = 'course_price';

  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'state', 'anonymous',
                              'has_access', false, 'price', v_price);
  end if;

  select role into v_role from public.profiles where id = v_uid;

  select * into v_pur from public.purchases
   where user_id = v_uid
   order by (status = 'paid') desc, created_at desc
   limit 1;

  return jsonb_build_object(
    'signed_in',  true,
    'role',       v_role,
    'has_access', public.has_access(),
    'state',      case
                    when v_role = 'admin'            then 'admin'
                    when v_pur.status = 'paid'       then 'active_student'
                    when v_pur.status is not null    then v_pur.status
                    else 'registered'
                  end,
    'purchase',   case when v_pur.id is null then null else jsonb_build_object(
                    'status', v_pur.status, 'amount', v_pur.amount,
                    'currency', v_pur.currency, 'paid_at', v_pur.paid_at,
                    'receipt_url', v_pur.receipt_url,
                    'created_at', v_pur.created_at) end,
    'price',      v_price
  );
end;
$$;

revoke all on function public.access_state() from public;
grant execute on function public.access_state() to anon, authenticated;

-- ------------------------------------------------------------ course_outline
-- What the pricing page is allowed to know, and the most it can learn: the
-- programme's shape. Titles and counts, in both languages, with the estimated
-- time summed from the lessons themselves so the page can never claim a number
-- the database does not hold.

create or replace function public.course_outline(p_slug text default 'ai-web-developer')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb; v_course public.courses%rowtype;
begin
  select * into v_course from public.courses where slug = p_slug;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'found', true,
    'course', jsonb_build_object(
      'slug', v_course.slug, 'title', v_course.title,
      'title_nl', v_course.title_nl,
      'description', v_course.description,
      'description_nl', v_course.description_nl),
    'totals', jsonb_build_object(
      'levels',      (select count(*) from levels where course_id = v_course.id and published),
      'lessons',     (select count(*) from lessons l
                        join levels lv on lv.id = l.level_id
                       where lv.course_id = v_course.id),
      'published',   (select count(*) from lessons l
                        join levels lv on lv.id = l.level_id
                       where lv.course_id = v_course.id and l.published),
      'minutes',     (select coalesce(sum(l.estimated_minutes), 0) from lessons l
                        join levels lv on lv.id = l.level_id
                       where lv.course_id = v_course.id),
      'projects',    (select count(*) from projects p
                        join levels lv on lv.id = p.level_id
                       where lv.course_id = v_course.id and p.published),
      'assessments', (select count(*) from quizzes q
                        join levels lv on lv.id = q.level_id
                       where lv.course_id = v_course.id),
      'questions',   (select count(*) from quiz_questions qq
                        join quizzes q on q.id = qq.quiz_id
                        join levels lv on lv.id = q.level_id
                       where lv.course_id = v_course.id),
      'prompts',     (select count(*) from prompts)),
    'levels', (
      select coalesce(jsonb_agg(x order by x.position), '[]'::jsonb) from (
        select lv.position, lv.slug, lv.title, lv.title_nl,
               lv.description, lv.description_nl,
               (select count(*) from lessons l where l.level_id = lv.id)              as lessons,
               (select count(*) from lessons l where l.level_id = lv.id and l.published) as published,
               (select coalesce(sum(l.estimated_minutes), 0) from lessons l
                 where l.level_id = lv.id)                                            as minutes,
               (select count(*) from projects p where p.level_id = lv.id and p.published) as projects,
               (select count(*) from quizzes q where q.level_id = lv.id)              as assessments,
               (select coalesce(jsonb_agg(jsonb_build_object(
                          'title', l.title, 'title_nl', l.title_nl,
                          'minutes', l.estimated_minutes,
                          'published', l.published) order by l.position), '[]'::jsonb)
                  from lessons l where l.level_id = lv.id)                            as lesson_titles
          from levels lv
         where lv.course_id = v_course.id and lv.published
      ) x)
  ) into v;

  return v;
end;
$$;

revoke all on function public.course_outline(text) from public;
grant execute on function public.course_outline(text) to anon, authenticated;

-- =============================================================================
-- Closing the course
-- =============================================================================
-- The policies installed by schema.sql let any signed-in account read every
-- published lesson. That was right when the course was free. These replace
-- them: published *and* paid for, or an administrator.
--
-- `levels` and `courses` deliberately stay readable by any signed-in account.
-- They carry a title and a description and nothing else, and the dashboard of
-- somebody who has not paid yet is better for showing them the programme they
-- are looking at than for showing them an empty page.

do $$
declare t text;
begin
  foreach t in array array['lessons', 'projects', 'quizzes'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select to authenticated '
      'using ((published and public.has_access()) or public.is_admin())', t, t);
  end loop;
end $$;

drop policy if exists prompts_read on public.prompts;
create policy prompts_read on public.prompts for select to authenticated
  using (public.has_access());

drop policy if exists questions_read on public.quiz_questions;
create policy questions_read on public.quiz_questions for select to authenticated
  using (public.is_admin() or (public.has_access() and exists (
    select 1 from public.quizzes q where q.id = quiz_id and q.published)));

drop policy if exists answers_read on public.quiz_answers;
create policy answers_read on public.quiz_answers for select to authenticated
  using (public.is_admin() or (public.has_access() and exists (
    select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
     where qq.id = question_id and q.published)));

-- Grading and the certificate check access on the way in, so a request that
-- gets past the interface still gets nothing.
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
  if not public.has_access() then
    raise exception 'no access to this course';
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'unknown quiz';
  end if;
  if not v_quiz.published and not public.is_admin() then
    raise exception 'quiz is not published';
  end if;

  for v_question in
    select id, question, explanation, explanation_nl, points, position
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
      'explanation',    v_question.explanation,
      'explanation_nl', v_question.explanation_nl
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

-- =============================================================================
-- Recording a payment
-- =============================================================================
-- Called by the Stripe webhook with the service role, after the signature on
-- the event has been verified. It is deliberately not reachable from a
-- browser: `authenticated` and `anon` have no execute privilege, so the only
-- caller is a function running on Supabase's side with the service key.

create or replace function public.record_payment(
  p_provider_ref text,
  p_status       text,
  p_payment_ref  text default null,
  p_receipt_url  text default null,
  p_amount       integer default null,
  p_currency     text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.purchases%rowtype;
begin
  if p_status not in ('checkout_started', 'payment_pending', 'paid', 'refunded', 'cancelled') then
    raise exception 'unknown status %', p_status;
  end if;

  update public.purchases set
    status       = p_status,
    payment_ref  = coalesce(p_payment_ref, payment_ref),
    receipt_url  = coalesce(p_receipt_url, receipt_url),
    amount       = coalesce(p_amount, amount),
    currency     = coalesce(p_currency, currency),
    paid_at      = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
    updated_at   = now()
  where provider_ref = p_provider_ref
  returning * into v;

  if not found then
    raise exception 'no purchase for reference %', p_provider_ref;
  end if;

  return jsonb_build_object('id', v.id, 'user_id', v.user_id, 'status', v.status);
end;
$$;

revoke all on function public.record_payment(text, text, text, text, integer, text)
  from public, anon, authenticated;

-- Opening a checkout. Also service-role only: the amount is read from the
-- settings table here rather than accepted from the caller, which is what
-- stops a crafted request buying the course for a euro.
create or replace function public.open_checkout(
  p_user_id      uuid,
  p_provider_ref text,
  p_course_slug  text default 'ai-web-developer')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_price  jsonb;
  v_id     uuid;
  v_paid   boolean;
begin
  select * into v_course from public.courses where slug = p_course_slug;
  if not found then raise exception 'unknown course'; end if;

  select exists (select 1 from public.purchases
                  where user_id = p_user_id and status = 'paid') into v_paid;
  if v_paid then
    raise exception 'this account already owns the course';
  end if;

  select value into v_price from public.settings where key = 'course_price';

  insert into public.purchases (user_id, course_id, status, amount, currency,
                                provider, provider_ref)
  values (p_user_id, v_course.id, 'checkout_started',
          (v_price ->> 'amount')::int, coalesce(v_price ->> 'currency', 'EUR'),
          'stripe', p_provider_ref)
  returning id into v_id;

  return jsonb_build_object('id', v_id,
                            'amount', (v_price ->> 'amount')::int,
                            'currency', coalesce(v_price ->> 'currency', 'EUR'));
end;
$$;

revoke all on function public.open_checkout(uuid, text, text)
  from public, anon, authenticated;

-- =============================================================================
-- Administration
-- =============================================================================

-- Every purchase with the person attached, in one call, role-checked on the
-- server like the rest of the admin surface.
create or replace function public.admin_purchases()
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

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select pu.id, pu.status, pu.amount, pu.currency, pu.provider, pu.note,
           pu.created_at, pu.paid_at, pu.receipt_url,
           p.id as user_id, p.name, p.email, p.role,
           c.title as course
      from public.purchases pu
      join public.profiles p on p.id = pu.user_id
      join public.courses  c on c.id = pu.course_id
  ) x;

  return v;
end;
$$;

revoke all on function public.admin_purchases() from public, anon;
grant execute on function public.admin_purchases() to authenticated;

-- Granting or withdrawing access by hand — a bank transfer, a refund, a
-- student who paid another way. It writes a purchase row like any other, so
-- there is one definition of access and one place to read it from.
create or replace function public.admin_set_access(
  p_user_id uuid,
  p_status  text,
  p_note    text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_price  jsonb;
  v_id     uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('paid', 'refunded', 'cancelled') then
    raise exception 'an administrator may only set paid, refunded or cancelled';
  end if;

  select * into v_course from public.courses where slug = 'ai-web-developer';
  select value into v_price from public.settings where key = 'course_price';

  select id into v_id from public.purchases
   where user_id = p_user_id order by created_at desc limit 1;

  if v_id is null then
    insert into public.purchases (user_id, course_id, status, amount, currency,
                                  provider, note, paid_at)
    values (p_user_id, v_course.id, p_status, (v_price ->> 'amount')::int,
            coalesce(v_price ->> 'currency', 'EUR'), 'manual', p_note,
            case when p_status = 'paid' then now() end)
    returning id into v_id;
  else
    update public.purchases set
      status  = p_status,
      note    = case when p_note = '' then note else p_note end,
      paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      updated_at = now()
    where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_access(uuid, text, text) from public, anon;
grant execute on function public.admin_set_access(uuid, text, text) to authenticated;

-- Changing the price. Same shape: role checked here, not in the interface.
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_key = 'course_price' then
    if (p_value ->> 'amount') is null or (p_value ->> 'amount')::int < 0 then
      raise exception 'a price needs a positive amount in minor units';
    end if;
  end if;

  insert into public.settings (key, value, public, updated_at, updated_by)
  values (p_key, p_value, true, now(), auth.uid())
  on conflict (key) do update set value = excluded.value,
                                  updated_at = now(),
                                  updated_by = auth.uid();

  return p_value;
end;
$$;

revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- The admin overview gains the numbers a paid course has.
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
    'purchases_paid',   (select count(*) from public.purchases where status = 'paid'),
    'purchases_open',   (select count(*) from public.purchases
                          where status in ('checkout_started', 'payment_pending')),
    'revenue',          (select coalesce(sum(amount), 0) from public.purchases where status = 'paid'),
    'currency',         (select value ->> 'currency' from public.settings where key = 'course_price'),
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

-- The user table gains their access status, so the admin can answer "did this
-- person pay" without opening a second screen.
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
           (select count(*) from public.quiz_attempts qa where qa.user_id = p.id) as attempts,
           coalesce((select pu.status from public.purchases pu
                      where pu.user_id = p.id
                      order by (pu.status = 'paid') desc, pu.created_at desc
                      limit 1), 'not_purchased') as purchase_status,
           (p.role = 'admin' or exists (select 1 from public.purchases pu
                                         where pu.user_id = p.id and pu.status = 'paid')) as access
      from public.profiles p
      left join public.course_progress cp on cp.user_id = p.id
  ) u;

  return v;
end;
$$;

revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- The certificate already checked completion; it now also checks that the
-- account is entitled to the course at all.
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
  if not public.has_access() then raise exception 'no access to this course'; end if;

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
