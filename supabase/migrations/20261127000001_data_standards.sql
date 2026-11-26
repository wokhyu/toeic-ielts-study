-- Data standards and a full learning record.
--
--   * every foreign key has an index; RLS policies call auth.uid() / is_admin()
--     through a sub-select so Postgres evaluates them once per query
--     (Supabase advisor lint "auth_rls_initplan")
--   * value-range checks, updated_at columns and comments on every table
--   * internal security definer helpers are no longer callable by learners
--   * ot_responses: one row per answer (practice, exam, mock) with the response,
--     result and time taken. This is the source for progress and admin analytics;
--     ot_question_stats stays as a per-question summary for fast lookups.
--   * spaced review of wrong answers (next_due: 1, 3, then 7 days)
--   * flashcard_review_log, admin_audit_log, achievements
--   * roadmap_tasks: the roadmap as reference data, so progress can be analysed
--     by week and skill; task_progress.task_id references it
--   * mock_scores records whether a score was self-reported or graded by a mock test
--   * learner_activity: one view over all of the above, by Vietnam date

------------------------------------------------------------------ shared helpers
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.vn_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

------------------------------------------------------------------ updated_at
alter table public.profiles add column updated_at timestamptz not null default now();
alter table public.enrollments add column updated_at timestamptz not null default now();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

------------------------------------------------------------------ value ranges
alter table public.mock_scores
  add column source text not null default 'self' check (source in ('self', 'mock_test')),
  add column attempt_id bigint unique references public.ot_attempts (id) on delete set null,
  add constraint mock_scores_range check (
    case course_id
      when 'toeic' then total between 0 and 990
        and coalesce(listening, 0) between 0 and 495 and coalesce(reading, 0) between 0 and 495
      when 'ielts' then total between 0 and 9
        and coalesce(listening, 0) between 0 and 9 and coalesce(reading, 0) between 0 and 9
        and coalesce(writing, 0) between 0 and 9 and coalesce(speaking, 0) between 0 and 9
      else total >= 0
    end
  ),
  add constraint mock_scores_graded_has_attempt check (source = 'self' or attempt_id is not null);

alter table public.placement_results
  add constraint placement_results_counts check (
    (correct_count is null or correct_count >= 0)
    and (total is null or total > 0)
    and (correct_count is null or total is null or correct_count <= total)
  ),
  add constraint placement_results_real_score check (
    real_score is null or real_score >= 0 and real_score <= case course_id when 'ielts' then 9 else 990 end
  );

alter table public.flashcard_reviews
  add column last_rating text check (last_rating in ('again', 'hard', 'good', 'easy')),
  add constraint flashcard_reviews_ranges check (ease >= 1.3 and ease <= 5 and interval_days >= 0 and reps >= 0);

------------------------------------------------------------------ roadmap reference data
create table public.roadmap_tasks (
  id text primary key,
  course_id text not null references public.courses (id),
  week int check (week between 1 and 12),
  day int check (day between 1 and 7),
  skill text,
  track text check (track in ('all', 'A', 'B', 'C')),
  minutes int check (minutes > 0),
  title text not null default '',
  group_activity boolean not null default false,
  check (id like course_id || '-%')
);
create index roadmap_tasks_course on public.roadmap_tasks (course_id, week, day);

-- Rows for progress recorded before this table existed; the content sync fills them in.
insert into public.roadmap_tasks (id, course_id)
select distinct task_id, course_id from public.task_progress
on conflict (id) do nothing;

alter table public.task_progress
  add column source text not null default 'manual' check (source in ('manual', 'auto')),
  add constraint task_progress_task_fk foreign key (task_id) references public.roadmap_tasks (id);
create index task_progress_task on public.task_progress (task_id);

-- Ticking a task that the content sync has not loaded yet must still work
-- (a deploy can reach learners a minute before the sync does): add a stub row.
create function public.task_progress_ensure_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.roadmap_tasks (id, course_id) values (new.task_id, new.course_id)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger task_progress_ensure_task before insert on public.task_progress
  for each row execute function public.task_progress_ensure_task();

alter table public.roadmap_tasks enable row level security;
create policy "readable by signed-in users" on public.roadmap_tasks
  for select to authenticated using (true);
revoke insert, update, delete on public.roadmap_tasks from anon, authenticated;
revoke select on public.roadmap_tasks from anon;

-- Content sync (service role): [{"id", "week", "day", "skill", "track", "minutes", "title", "group_activity"}]
create function public.content_upsert_roadmap_tasks(p_course text, p_tasks jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  insert into public.roadmap_tasks (id, course_id, week, day, skill, track, minutes, title, group_activity)
  select t ->> 'id', p_course, (t ->> 'week')::int, (t ->> 'day')::int, t ->> 'skill', t ->> 'track',
         (t ->> 'minutes')::int, coalesce(t ->> 'title', ''), coalesce((t ->> 'group_activity')::boolean, false)
    from jsonb_array_elements(p_tasks) t
  on conflict (id) do update set
    course_id = excluded.course_id, week = excluded.week, day = excluded.day, skill = excluded.skill,
    track = excluded.track, minutes = excluded.minutes, title = excluded.title,
    group_activity = excluded.group_activity;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

------------------------------------------------------------------ learning record
create table public.ot_responses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  question_id int not null references public.ot_questions (id) on delete cascade,
  attempt_id bigint references public.ot_attempts (id) on delete cascade,
  mode text not null check (mode in ('practice', 'review', 'exam', 'mock')),
  response jsonb,
  is_correct boolean,
  score int check (score between 0 and 100),
  time_ms int check (time_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  check ((mode in ('exam', 'mock')) = (attempt_id is not null))
);
create index ot_responses_user on public.ot_responses (user_id, created_at);
create index ot_responses_course on public.ot_responses (course_id, created_at);
create index ot_responses_question on public.ot_responses (question_id);
create index ot_responses_attempt on public.ot_responses (attempt_id);

alter table public.ot_attempt_answers add column time_ms int check (time_ms >= 0);

alter table public.ot_question_stats
  add column last_wrong_at timestamptz,
  add column correct_streak int not null default 0 check (correct_streak >= 0),
  add column next_due date,
  add constraint ot_question_stats_counts check (seen >= 0 and correct >= 0 and correct <= seen);
create index ot_question_stats_due on public.ot_question_stats (user_id, next_due) where next_due is not null;

create table public.flashcard_review_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  card_id text not null,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  interval_before int not null default 0 check (interval_before >= 0),
  interval_after int not null check (interval_after >= 0),
  reviewed_at timestamptz not null default now()
);
create index flashcard_review_log_user on public.flashcard_review_log (user_id, reviewed_at);
create index flashcard_review_log_course on public.flashcard_review_log (course_id, reviewed_at);

-- The server sets the review time and logs every rating the learner gives.
create function public.flashcard_reviews_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.last_reviewed_at := now();
  return new;
end;
$$;
create trigger flashcard_reviews_touch before insert or update on public.flashcard_reviews
  for each row execute function public.flashcard_reviews_touch();

create function public.flashcard_reviews_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.last_rating is not null then
    insert into public.flashcard_review_log (user_id, course_id, card_id, rating, interval_before, interval_after)
    values (
      new.user_id, new.course_id, new.card_id, new.last_rating,
      case when tg_op = 'UPDATE' then old.interval_days else 0 end, new.interval_days
    );
  end if;
  return null;
end;
$$;
create trigger flashcard_reviews_log after insert or update on public.flashcard_reviews
  for each row execute function public.flashcard_reviews_log();

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_user uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_log_actor on public.admin_audit_log (actor_id);
create index admin_audit_log_target on public.admin_audit_log (target_user);
create index admin_audit_log_time on public.admin_audit_log (created_at);

create function public.audit(p_action text, p_target uuid, p_details jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, action, target_user, details)
  values (auth.uid(), p_action, p_target, coalesce(p_details, '{}'));
$$;

create table public.achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  badge_id text not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, course_id, badge_id)
);
create index achievements_course on public.achievements (course_id, awarded_at);

alter table public.ot_responses enable row level security;
alter table public.flashcard_review_log enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.achievements enable row level security;

create policy "own or admin" on public.ot_responses
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own or admin" on public.flashcard_review_log
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin only" on public.admin_audit_log
  for select to authenticated using ((select public.is_admin()));
create policy "own or admin" on public.achievements
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete on
  public.ot_responses, public.flashcard_review_log, public.admin_audit_log, public.achievements
from anon, authenticated;
revoke select on
  public.ot_responses, public.flashcard_review_log, public.admin_audit_log, public.achievements
from anon;

------------------------------------------------------------------ foreign key indexes
create index enrollments_course on public.enrollments (course_id);
create index enrollments_decided_by on public.enrollments (decided_by);
create index placement_results_user on public.placement_results (user_id, taken_at);
create index placement_results_course on public.placement_results (course_id);
create index mock_scores_user on public.mock_scores (user_id, course_id, taken_at);
create index mock_scores_course on public.mock_scores (course_id);
create index flashcard_reviews_course on public.flashcard_reviews (course_id);
create index ot_chapters_subject on public.ot_chapters (subject_id);
create index ot_topics_chapter on public.ot_topics (chapter_id);
create index ot_sources_subject on public.ot_sources (subject_id);
create index ot_sources_course on public.ot_sources (course_id);
create index ot_questions_source on public.ot_questions (source_id);
create index ot_attempts_course_id on public.ot_attempts (course_id);
create index ot_attempts_mock_test on public.ot_attempts (mock_test_id);
create index ot_question_stats_question on public.ot_question_stats (question_id);
create index ot_bookmarks_question on public.ot_bookmarks (question_id);
create index ot_stimuli_course on public.ot_stimuli (course_id);
create index ot_mock_tests_course on public.ot_mock_tests (course_id);
create index ot_mock_questions_question on public.ot_mock_questions (question_id);

------------------------------------------------------------------ RLS: evaluate auth.uid() once per query
drop policy "own profile or admin" on public.profiles;
drop policy "update own profile" on public.profiles;
create policy "own profile or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "own enrollments or admin" on public.enrollments;
drop policy "learner sets own track and start date once approved" on public.enrollments;
create policy "own enrollments or admin" on public.enrollments
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "learner sets own track and start date once approved" on public.enrollments
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'approved')
  with check (user_id = (select auth.uid()) and status = 'approved');

drop policy "read own or admin" on public.task_progress;
drop policy "write own while enrolled" on public.task_progress;
drop policy "delete own" on public.task_progress;
create policy "read own or admin" on public.task_progress
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "write own while enrolled" on public.task_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_enrolled(course_id) and source = 'manual');
create policy "delete own" on public.task_progress
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy "read own or admin" on public.placement_results;
drop policy "write own while enrolled" on public.placement_results;
create policy "read own or admin" on public.placement_results
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "write own while enrolled" on public.placement_results
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_enrolled(course_id));

drop policy "read own or admin" on public.mock_scores;
drop policy "write own while enrolled" on public.mock_scores;
drop policy "delete own" on public.mock_scores;
create policy "read own or admin" on public.mock_scores
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Learners may only add and remove their own self-reported scores; graded ones come from mock tests.
create policy "write own self-reported while enrolled" on public.mock_scores
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_enrolled(course_id) and source = 'self' and attempt_id is null);
create policy "delete own self-reported" on public.mock_scores
  for delete to authenticated using (user_id = (select auth.uid()) and source = 'self');

drop policy "read own or admin" on public.flashcard_reviews;
drop policy "insert own while enrolled" on public.flashcard_reviews;
drop policy "update own while enrolled" on public.flashcard_reviews;
create policy "read own or admin" on public.flashcard_reviews
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own while enrolled" on public.flashcard_reviews
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_enrolled(course_id));
create policy "update own while enrolled" on public.flashcard_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_enrolled(course_id));

drop policy "enrolled or admin" on public.ot_subjects;
drop policy "enrolled or admin" on public.ot_sources;
create policy "enrolled or admin" on public.ot_subjects
  for select to authenticated using ((select public.is_admin()) or public.is_enrolled(course_id));
create policy "enrolled or admin" on public.ot_sources
  for select to authenticated using ((select public.is_admin()) or public.is_enrolled(course_id));

drop policy "ready practice questions, own mock questions, admin all" on public.ot_questions;
create policy "ready practice questions, own mock questions, admin all" on public.ot_questions
  for select to authenticated using (
    (select public.is_admin())
    or (
      status = 'ok' and public.is_enrolled(course_id)
      and (
        pool = 'practice'
        or exists (
          select 1 from public.ot_attempt_answers aa join public.ot_attempts a on a.id = aa.attempt_id
           where aa.question_id = ot_questions.id and a.user_id = (select auth.uid())
        )
      )
    )
  );

drop policy "published for enrolled, admin all" on public.ot_mock_tests;
drop policy "admin only" on public.ot_mock_questions;
drop policy "admin only" on public.ot_question_keys;
create policy "published for enrolled, admin all" on public.ot_mock_tests
  for select to authenticated using ((select public.is_admin()) or (published and public.is_enrolled(course_id)));
create policy "admin only" on public.ot_mock_questions
  for select to authenticated using ((select public.is_admin()));
create policy "admin only" on public.ot_question_keys
  for select to authenticated using ((select public.is_admin()));

drop policy "own or admin" on public.ot_attempts;
drop policy "own or admin" on public.ot_attempt_answers;
drop policy "own or admin" on public.ot_question_stats;
drop policy "own or admin" on public.ot_bookmarks;
create policy "own or admin" on public.ot_attempts
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own or admin" on public.ot_attempt_answers
  for select to authenticated using (
    exists (
      select 1 from public.ot_attempts a
       where a.id = attempt_id and (a.user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );
create policy "own or admin" on public.ot_question_stats
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own or admin" on public.ot_bookmarks
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

------------------------------------------------------------------ answering
-- Summary per learner and question, plus spaced review of mistakes: a wrong
-- answer is due again tomorrow; then 3 and 7 days after each correct answer;
-- three correct answers in a row clear it from the review list.
create or replace function public.ot_bump_stats(p_user uuid, p_question int, p_correct boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.vn_today();
begin
  insert into public.ot_question_stats as s
    (user_id, question_id, seen, correct, last_seen_at, last_wrong_at, correct_streak, next_due)
  values (
    p_user, p_question, 1, case when p_correct then 1 else 0 end, now(),
    case when p_correct is false then now() end,
    case when p_correct then 1 else 0 end,
    case when p_correct is false then v_today + 1 end
  )
  on conflict (user_id, question_id) do update set
    seen = s.seen + 1,
    correct = s.correct + excluded.correct,
    last_seen_at = excluded.last_seen_at,
    last_wrong_at = coalesce(excluded.last_wrong_at, s.last_wrong_at),
    correct_streak = case
      when p_correct is null then s.correct_streak
      when p_correct then s.correct_streak + 1
      else 0
    end,
    next_due = case
      when p_correct is null then s.next_due
      when not p_correct then v_today + 1
      when s.next_due is null then null
      when s.correct_streak + 1 >= 3 then null
      when s.correct_streak + 1 = 2 then v_today + 7
      else v_today + 3
    end;
end;
$$;

drop function public.ot_answer_practice(int, jsonb);
-- p_mode is 'review' when the question comes from the review list.
-- p_time_ms is the time from showing the question to checking it, measured in the browser.
create function public.ot_answer_practice(
  p_question int,
  p_response jsonb,
  p_time_ms int default null,
  p_mode text default 'practice'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_type text;
  v_key jsonb;
  v_solution text;
  v_course text;
  g record;
begin
  v_course := public.ot_question_course(p_question);
  perform public.ot_require_course(v_course);
  perform public.ot_require_not_in_open_exam(p_question);
  if p_mode not in ('practice', 'review') then
    raise exception 'invalid mode %', p_mode using errcode = '22023';
  end if;
  select q.type, k.answer_key, coalesce(k.solution_html, '')
    into v_type, v_key, v_solution
    from public.ot_questions q left join public.ot_question_keys k on k.question_id = q.id
   where q.id = p_question and q.status = 'ok' and q.pool = 'practice';
  if not found then
    raise exception 'question % not found', p_question using errcode = 'P0002';
  end if;
  select * into g from public.ot_grade(v_type, v_key, p_response);
  perform public.ot_bump_stats(auth.uid(), p_question, g.is_correct);
  insert into public.ot_responses (user_id, course_id, question_id, mode, response, is_correct, score, time_ms)
  values (auth.uid(), v_course, p_question, p_mode, p_response, g.is_correct, g.score,
          least(greatest(p_time_ms, 0), 3600000));
  return jsonb_build_object('score', g.score, 'is_correct', g.is_correct, 'answer_key', v_key, 'solution_html', v_solution);
end;
$$;

-- Exams show every question on one page, so the time for a question is the time
-- since the previous answer in the same attempt (or since the start), capped at 30 minutes.
create or replace function public.ot_save_answer(p_attempt bigint, p_question int, p_response jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_since timestamptz;
begin
  select greatest(a.started_at, coalesce(max(aa.answered_at), a.started_at)) into v_since
    from public.ot_attempts a
    left join public.ot_attempt_answers aa on aa.attempt_id = a.id
   where a.id = p_attempt and a.user_id = auth.uid() and a.submitted_at is null
     and (a.deadline_at is null or now() <= a.deadline_at + interval '60 seconds')
   group by a.id, a.started_at;
  if not found then
    return false;
  end if;
  update public.ot_attempt_answers
     set response = p_response,
         answered_at = now(),
         time_ms = coalesce(time_ms, 0)
                   + least(greatest((extract(epoch from now() - v_since) * 1000)::int, 0), 1800000)
   where attempt_id = p_attempt and question_id = p_question;
  return found;
end;
$$;

create or replace function public.ot_submit_exam(p_attempt bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  g record;
  v_total int := 0;
  v_max int := 0;
  v_submitted timestamptz;
  v_mode text;
  v_course text;
begin
  select submitted_at, mode, course_id into v_submitted, v_mode, v_course
    from public.ot_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if v_submitted is null then
    for r in
      select aa.question_id, aa.response, aa.time_ms, q.type, k.answer_key
        from public.ot_attempt_answers aa
        join public.ot_questions q on q.id = aa.question_id
        left join public.ot_question_keys k on k.question_id = aa.question_id
       where aa.attempt_id = p_attempt
       order by aa.sort
    loop
      select * into g from public.ot_grade(r.type, r.answer_key, r.response);
      update public.ot_attempt_answers set is_correct = g.is_correct, score = g.score
       where attempt_id = p_attempt and question_id = r.question_id;
      if g.score is not null then
        v_total := v_total + g.score;
        v_max := v_max + 100;
      end if;
      perform public.ot_bump_stats(auth.uid(), r.question_id, g.is_correct);
      -- Unanswered questions are recorded too (response null, counted wrong), as in a real test.
      insert into public.ot_responses (user_id, course_id, question_id, attempt_id, mode, response, is_correct, score, time_ms)
      values (auth.uid(), v_course, r.question_id, p_attempt, v_mode, r.response, g.is_correct, g.score,
              least(r.time_ms, 3600000));
    end loop;
    update public.ot_attempts set submitted_at = now(), score = v_total, max_score = v_max where id = p_attempt;
    if v_mode = 'mock' then
      perform public.ot_record_mock_score(p_attempt);
    end if;
  end if;
  return (
    select jsonb_build_object('score', score, 'max_score', max_score)
           || case when mode = 'mock' then jsonb_build_object('sections', config -> 'sections', 'total', config -> 'total')
                   else '{}'::jsonb end
      from public.ot_attempts where id = p_attempt
  );
end;
$$;

create or replace function public.ot_record_mock_score(p_attempt bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  t record;
  sec jsonb;
  v_key text;
  v_raw int;
  v_max int;
  v_scaled numeric;
  v_result jsonb := '{}';
  v_sum numeric := 0;
  v_n int := 0;
  v_total numeric;
begin
  select * into a from public.ot_attempts where id = p_attempt;
  select * into t from public.ot_mock_tests where id = a.mock_test_id;
  if not found then
    return null;
  end if;

  for sec in select value from jsonb_array_elements(t.sections) loop
    v_key := sec ->> 'key';
    select count(*) filter (where aa.is_correct), count(*)
      into v_raw, v_max
      from public.ot_attempt_answers aa
      join public.ot_mock_questions mq on mq.test_id = t.id and mq.question_id = aa.question_id
     where aa.attempt_id = p_attempt and mq.section = v_key;
    select (e ->> 1)::numeric into v_scaled
      from jsonb_array_elements(sec -> 'scale') e
     where (e ->> 0)::int <= v_raw
     order by (e ->> 0)::int desc
     limit 1;
    v_scaled := coalesce(v_scaled, 0);
    v_result := v_result || jsonb_build_object(
      v_key, jsonb_build_object('label', sec ->> 'label', 'raw', v_raw, 'max', v_max, 'scaled', v_scaled)
    );
    v_sum := v_sum + v_scaled;
    v_n := v_n + 1;
  end loop;

  v_total := case
    when a.course_id = 'ielts' then floor(v_sum / greatest(v_n, 1) * 2 + 0.5) / 2
    else v_sum
  end;

  insert into public.mock_scores
    (user_id, course_id, week, listening, reading, writing, speaking, total, source, attempt_id)
  values (
    a.user_id, a.course_id, t.week,
    (v_result -> 'listening' ->> 'scaled')::numeric,
    (v_result -> 'reading' ->> 'scaled')::numeric,
    (v_result -> 'writing' ->> 'scaled')::numeric,
    (v_result -> 'speaking' ->> 'scaled')::numeric,
    v_total, 'mock_test', p_attempt
  )
  on conflict (attempt_id) do nothing;
  update public.ot_attempts
     set config = coalesce(config, '{}') || jsonb_build_object('sections', v_result, 'total', v_total)
   where id = p_attempt;
  return jsonb_build_object('sections', v_result, 'total', v_total);
end;
$$;

------------------------------------------------------------------ admin actions, audited
create or replace function public.admin_set_enrollment(
  p_user uuid,
  p_course text,
  p_status text,
  p_track text default null,
  p_start_date date default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'revoked') then
    raise exception 'invalid status %', p_status using errcode = '22023';
  end if;
  insert into public.enrollments (user_id, course_id, status, track, start_date, decided_at, decided_by)
  values (p_user, p_course, p_status, p_track, p_start_date, now(), auth.uid())
  on conflict (user_id, course_id) do update set
    status = excluded.status,
    track = coalesce(excluded.track, public.enrollments.track),
    start_date = coalesce(excluded.start_date, public.enrollments.start_date),
    decided_at = now(),
    decided_by = auth.uid();
  perform public.audit('set_enrollment', p_user, jsonb_build_object(
    'course', p_course, 'status', p_status, 'track', p_track, 'start_date', p_start_date));
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_role not in ('learner', 'admin') then
    raise exception 'invalid role %', p_role using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'admins cannot remove their own admin role' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  perform public.audit('set_role', p_user, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.ot_admin_set_key(p_question int, p_key jsonb, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_status not in ('ok', 'hidden') then
    raise exception 'invalid status %', p_status using errcode = '22023';
  end if;
  insert into public.ot_question_keys (question_id, answer_key, answer_source)
  values (p_question, p_key, 'manual')
  on conflict (question_id) do update set answer_key = excluded.answer_key, answer_source = 'manual';
  update public.ot_questions
     set status = case
       when (p_key is null or jsonb_typeof(p_key) = 'null') and p_status = 'ok' and type <> 'essay' then 'needs_review'
       else p_status
     end
   where id = p_question;
  perform public.audit('set_question_key', null, jsonb_build_object(
    'question', p_question, 'key', p_key, 'status', p_status));
end;
$$;

------------------------------------------------------------------ one view of all activity
-- RLS of the underlying tables applies (security_invoker), so learners see their
-- own rows and admins see everyone's. day is the Vietnam calendar date.
create view public.learner_activity with (security_invoker = true) as
  select r.user_id, r.course_id, r.mode as kind, r.created_at as occurred_at,
         (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
         r.question_id::text as ref, r.is_correct, r.time_ms
    from public.ot_responses r
  union all
  select t.user_id, t.course_id, 'task', t.completed_at,
         (t.completed_at at time zone 'Asia/Ho_Chi_Minh')::date, t.task_id, null, null
    from public.task_progress t
  union all
  select f.user_id, f.course_id, 'flashcard', f.reviewed_at,
         (f.reviewed_at at time zone 'Asia/Ho_Chi_Minh')::date, f.card_id, f.rating <> 'again', null
    from public.flashcard_review_log f;
revoke all on public.learner_activity from anon;
grant select on public.learner_activity to authenticated;

------------------------------------------------------------------ function privileges
-- Supabase grants EXECUTE on new functions to every API role by default. Internal
-- helpers must not be callable from the browser: ot_bump_stats, for example,
-- could otherwise rewrite anyone's statistics.
revoke execute on function
  public.set_updated_at(),
  public.vn_today(),
  public.task_progress_ensure_task(),
  public.content_upsert_roadmap_tasks(text, jsonb),
  public.flashcard_reviews_touch(),
  public.flashcard_reviews_log(),
  public.audit(text, uuid, jsonb),
  public.ot_bump_stats(uuid, int, boolean),
  public.ot_require_not_in_open_exam(int),
  public.ot_parse_number(text),
  public.ot_grade(text, jsonb, jsonb),
  public.ot_answer_practice(int, jsonb, int, text),
  public.handle_new_user()
from public, anon, authenticated;

grant execute on function public.ot_answer_practice(int, jsonb, int, text) to authenticated;
grant execute on function public.content_upsert_roadmap_tasks(text, jsonb) to service_role;

------------------------------------------------------------------ documentation
comment on table public.courses is 'Courses offered on the site. kind: roadmap (TOEIC, IELTS: 12-week plan) or question_bank (on-tap-11).';
comment on table public.profiles is 'One row per auth user, created by handle_new_user(). role is learner or admin; changed only through admin_set_role().';
comment on table public.enrollments is 'A learner''s request to join a course and the admin decision. track (A/B/C) and start_date drive the roadmap.';
comment on column public.enrollments.decided_by is 'Admin who last changed the status.';
comment on table public.task_progress is 'Roadmap tasks a learner has ticked. Deleting a row un-ticks the task.';
comment on column public.task_progress.source is 'manual: ticked by the learner; auto: ticked by the site after the linked practice was done.';
comment on table public.roadmap_tasks is 'The roadmap as reference data (content/roadmap/**), loaded by the content sync. Rows with null week are stubs waiting for the sync.';
comment on table public.placement_results is 'Placement tests and real scores used to choose a roadmap track.';
comment on column public.placement_results.answers is 'Question id -> chosen option, as submitted.';
comment on table public.mock_scores is 'Mock test scores over time. TOEIC: section 0-495, total 0-990. IELTS: bands 0-9.';
comment on column public.mock_scores.source is 'self: typed in by the learner; mock_test: graded by the site (attempt_id set).';
comment on column public.mock_scores.week is 'Roadmap week the test belongs to, when known.';
comment on table public.flashcard_reviews is 'Current spaced-repetition state of each card for each learner (simplified SM-2, see src/lib/srs.ts).';
comment on column public.flashcard_reviews.last_rating is 'Rating of the latest review; every review is also written to flashcard_review_log.';
comment on table public.flashcard_review_log is 'Every flashcard review: rating and interval before/after. Written by a trigger on flashcard_reviews.';
comment on table public.ot_subjects is 'Question bank (shared engine for on-tap-11, TOEIC and IELTS; the ot_ prefix is historical): top level, e.g. a subject or the Listening/Reading section.';
comment on table public.ot_chapters is 'Question bank: chapter within a subject, e.g. TOEIC Part 5.';
comment on table public.ot_topics is 'Question bank: topic within a chapter.';
comment on table public.ot_sources is 'Question bank: the file or document a question came from.';
comment on table public.ot_questions is 'Question bank: questions. pool practice is open to enrolled learners; mock questions appear only inside a mock test.';
comment on column public.ot_questions.tags is 'Grammar points or question types used for targeted practice and analytics.';
comment on column public.ot_questions.ext_id is 'Stable id from content/bank (TOEIC, IELTS); null for on-tap-11.';
comment on table public.ot_question_keys is 'Answer keys and worked solutions. Admin-only; learners get them from functions after answering.';
comment on table public.ot_options is 'Choices of multiple-choice questions.';
comment on table public.ot_stimuli is 'Shared passages and listening scripts for groups of questions.';
comment on table public.ot_attempts is 'Timed exams and mock tests a learner has started.';
comment on table public.ot_attempt_answers is 'The questions of an attempt with the saved response and, after submission, the grade.';
comment on column public.ot_attempt_answers.time_ms is 'Time spent, approximated from the gaps between saved answers.';
comment on table public.ot_question_stats is 'Per learner and question summary of ot_responses, with the spaced review schedule for mistakes.';
comment on column public.ot_question_stats.next_due is 'Vietnam date when a missed question is due for review; null when it is not in the review list.';
comment on column public.ot_question_stats.correct_streak is 'Correct answers in a row since the last mistake.';
comment on table public.ot_bookmarks is 'Questions a learner has bookmarked.';
comment on table public.ot_mock_tests is 'Mock tests with their sections and raw-to-scaled score tables.';
comment on table public.ot_mock_questions is 'Questions of each mock test, in order. Admin-only so the test stays hidden.';
comment on table public.ot_responses is 'Learning record: one row per answer in practice, review, exams and mock tests. Source for progress and analytics.';
comment on column public.ot_responses.time_ms is 'Milliseconds spent on the question (browser-measured in practice, approximated in exams).';
comment on column public.ot_responses.response is 'The learner''s answer as sent: an option label, text, or an object for true/false groups. Null if left blank in an exam.';
comment on table public.admin_audit_log is 'Admin actions: enrollment decisions, role changes and answer-key edits.';
comment on table public.achievements is 'Badges a learner has earned in a course.';
comment on view public.learner_activity is 'All learning activity (answers, tasks, flashcards) with the Vietnam date. Respects the RLS of the underlying tables.';
