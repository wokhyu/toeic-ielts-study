-- Roadmap tasks linked to the question bank (the "Làm ngay" button). A task's
-- `practice` says what the button opens:
--
--   {"kind": "practice", "tags": [...], "count": n}
--       answer n questions tagged with any of `tags`; earlier tags come first.
--       The task ticks itself once the learner has answered n of them.
--   {"kind": "exam", "minutes": m, "parts": [{"label", "tags", "count"}, ...]}
--       a timed mini test built from the parts; ticks itself when submitted.
--   {"kind": "mock"}
--       the course's mock test for the task's week; ticks itself when submitted.
--
-- Answers and attempts made for a task keep the task id, so progress survives
-- reloads and devices, and analysis can tell roadmap work from free practice.

------------------------------------------------------------------ schema
alter table public.roadmap_tasks
  add column practice jsonb check (
    practice is null
    or (jsonb_typeof(practice) = 'object' and practice ->> 'kind' in ('practice', 'exam', 'mock'))
  );
comment on column public.roadmap_tasks.practice is
  'What the "Làm ngay" button opens: practice (tags, count), exam (minutes, parts) or mock. Null: no link.';

alter table public.ot_responses
  add column task_id text references public.roadmap_tasks (id) on delete set null;
create index ot_responses_task on public.ot_responses (task_id, user_id) where task_id is not null;
comment on column public.ot_responses.task_id is 'Roadmap task the answer was given for (practice links only).';

alter table public.ot_attempts
  add column task_id text references public.roadmap_tasks (id) on delete set null;
create index ot_attempts_task on public.ot_attempts (task_id) where task_id is not null;
comment on column public.ot_attempts.task_id is 'Roadmap task the exam was started from (exam links only).';

-- Content sync (service role): the same payload as before, plus "practice".
create or replace function public.content_upsert_roadmap_tasks(p_course text, p_tasks jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  insert into public.roadmap_tasks
    (id, course_id, week, day, skill, track, minutes, title, group_activity, practice)
  select t ->> 'id', p_course, (t ->> 'week')::int, (t ->> 'day')::int, t ->> 'skill', t ->> 'track',
         (t ->> 'minutes')::int, coalesce(t ->> 'title', ''), coalesce((t ->> 'group_activity')::boolean, false),
         nullif(t -> 'practice', 'null'::jsonb)
    from jsonb_array_elements(p_tasks) t
  on conflict (id) do update set
    course_id = excluded.course_id, week = excluded.week, day = excluded.day, skill = excluded.skill,
    track = excluded.track, minutes = excluded.minutes, title = excluded.title,
    group_activity = excluded.group_activity, practice = excluded.practice;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

------------------------------------------------------------------ helpers
-- The task row, if it has a link of the given kind and the caller may use its course.
create function public.ot_task_for(p_task text, p_kind text) returns public.roadmap_tasks
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.roadmap_tasks;
begin
  select * into r from public.roadmap_tasks where id = p_task;
  if not found or r.practice is null or r.practice ->> 'kind' <> p_kind then
    raise exception 'task % has no % link', p_task, p_kind using errcode = 'P0002';
  end if;
  perform public.ot_require_course(r.course_id);
  return r;
end;
$$;

-- Ticks a task for a learner on the site's behalf. A task the learner already
-- ticked keeps its original time and source.
create function public.ot_tick_task(p_user uuid, p_task text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_progress (user_id, course_id, task_id, source)
  select p_user, rt.course_id, rt.id, 'auto' from public.roadmap_tasks rt where rt.id = p_task
  on conflict (user_id, task_id) do nothing;
  return found;
end;
$$;

------------------------------------------------------------------ practice links
-- Questions for a practice task. Order: questions not yet mastered (never seen,
-- or wrong last time) before mastered ones; within that, the task's first tags
-- before its broader ones; then unseen before wrong; questions of one set together.
create function public.ot_task_question_ids(p_task text, p_limit int default 20) returns setof int
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.roadmap_tasks;
  v_tags text[];
begin
  r := public.ot_task_for(p_task, 'practice');
  v_tags := array(select jsonb_array_elements_text(r.practice -> 'tags'));
  return query
  select x.id from (
    select q.id, q.set_id, q.number_in_source,
           case when qs.question_id is null then 0 when qs.correct_streak = 0 then 1 else 2 end as bucket,
           (select min(array_position(v_tags, tag)) from unnest(q.tags) tag) as priority
      from public.ot_questions q
      left join public.ot_question_stats qs on qs.question_id = q.id and qs.user_id = auth.uid()
     where q.course_id = r.course_id and q.status = 'ok' and q.pool = 'practice' and q.tags && v_tags
  ) x
   order by x.bucket = 2, x.priority, x.bucket, coalesce(x.set_id, ''), x.number_in_source, x.id
   limit least(greatest(p_limit, 1), 50);
end;
$$;

-- How many answers the caller has given for each of their practice tasks in a course.
create function public.ot_task_answer_counts(p_course text)
returns table (task_id text, answered int)
language sql stable set search_path = '' as $$
  select r.task_id, count(*)::int
    from public.ot_responses r
   where r.user_id = (select auth.uid()) and r.course_id = p_course and r.task_id is not null
   group by r.task_id;
$$;

drop function public.ot_answer_practice(int, jsonb, int, text);
-- p_mode is 'review' when the question comes from the review list.
-- p_time_ms is the time from showing the question to checking it, measured in the browser.
-- p_task is the roadmap task being practised. The answer counts towards it only
-- in practice mode and when the question carries one of the task's tags; the
-- result then includes {"task": {"id", "answered", "count", "done"}}.
create function public.ot_answer_practice(
  p_question int,
  p_response jsonb,
  p_time_ms int default null,
  p_mode text default 'practice',
  p_task text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_type text;
  v_tags text[];
  v_key jsonb;
  v_solution text;
  v_course text;
  v_practice jsonb;
  v_task_id text;
  v_answered int;
  v_task jsonb;
  g record;
begin
  v_course := public.ot_question_course(p_question);
  perform public.ot_require_course(v_course);
  perform public.ot_require_not_in_open_exam(p_question);
  if p_mode not in ('practice', 'review') then
    raise exception 'invalid mode %', p_mode using errcode = '22023';
  end if;
  select q.type, q.tags, k.answer_key, coalesce(k.solution_html, '')
    into v_type, v_tags, v_key, v_solution
    from public.ot_questions q left join public.ot_question_keys k on k.question_id = q.id
   where q.id = p_question and q.status = 'ok' and q.pool = 'practice';
  if not found then
    raise exception 'question % not found', p_question using errcode = 'P0002';
  end if;

  if p_task is not null and p_mode = 'practice' then
    select rt.id, rt.practice into v_task_id, v_practice
      from public.roadmap_tasks rt
     where rt.id = p_task and rt.course_id = v_course and rt.practice ->> 'kind' = 'practice'
       and v_tags && array(select jsonb_array_elements_text(rt.practice -> 'tags'));
  end if;

  select * into g from public.ot_grade(v_type, v_key, p_response);
  perform public.ot_bump_stats(auth.uid(), p_question, g.is_correct);
  insert into public.ot_responses
    (user_id, course_id, question_id, mode, response, is_correct, score, time_ms, task_id)
  values (auth.uid(), v_course, p_question, p_mode, p_response, g.is_correct, g.score,
          least(greatest(p_time_ms, 0), 3600000), v_task_id);

  if v_task_id is not null then
    select count(*) into v_answered
      from public.ot_responses where user_id = auth.uid() and task_id = v_task_id;
    if v_answered >= (v_practice ->> 'count')::int then
      perform public.ot_tick_task(auth.uid(), v_task_id);
    end if;
    v_task := jsonb_build_object(
      'id', v_task_id,
      'answered', v_answered,
      'count', (v_practice ->> 'count')::int,
      'done', exists (select 1 from public.task_progress where user_id = auth.uid() and task_id = v_task_id)
    );
  end if;

  return jsonb_build_object(
    'score', g.score, 'is_correct', g.is_correct, 'answer_key', v_key, 'solution_html', v_solution,
    'task', v_task
  );
end;
$$;

------------------------------------------------------------------ exam links
-- Starts the timed mini test of an exam task. Each part takes whole question
-- sets in random order (a conversation or passage stays together, cut only at
-- the end of the part) from the practice pool.
create function public.ot_start_task_exam(p_task text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  r public.roadmap_tasks;
  part jsonb;
  v_minutes int;
  v_attempt bigint;
  v_sort int := 0;
  v_n int;
  -- One random seed per call: sets are shuffled by md5(set || seed), which stays
  -- the same however often the planner evaluates it (random() would not).
  v_seed text := random()::text;
begin
  r := public.ot_task_for(p_task, 'exam');
  v_minutes := least(greatest(coalesce((r.practice ->> 'minutes')::int, 30), 1), 240);

  insert into public.ot_attempts (user_id, course_id, mode, config, deadline_at, task_id)
  values (
    auth.uid(), r.course_id, 'exam',
    jsonb_build_object('task_id', r.id, 'minutes', v_minutes, 'parts', r.practice -> 'parts'),
    now() + make_interval(mins => v_minutes),
    r.id
  )
  returning id into v_attempt;

  for part in select value from jsonb_array_elements(r.practice -> 'parts') loop
    insert into public.ot_attempt_answers (attempt_id, question_id, sort)
    select v_attempt, x.id, v_sort + (row_number() over (order by x.ord))::int - 1
      from (
        select c.id, row_number() over (order by md5(c.grp || v_seed), c.number_in_source, c.id) as ord
          from (
            select q.id, coalesce(q.set_id, q.id::text) as grp, q.number_in_source
              from public.ot_questions q
             where q.course_id = r.course_id and q.status = 'ok' and q.pool = 'practice'
               and q.type <> 'essay'
               and q.tags && array(select jsonb_array_elements_text(part -> 'tags'))
               and not exists (
                 select 1 from public.ot_attempt_answers aa
                  where aa.attempt_id = v_attempt and aa.question_id = q.id
               )
          ) c
         order by ord
         limit greatest((part ->> 'count')::int, 1)
      ) x;
    get diagnostics v_n = row_count;
    v_sort := v_sort + v_n;
  end loop;

  if v_sort = 0 then
    delete from public.ot_attempts where id = v_attempt;
    raise exception 'no questions for task %', p_task using errcode = 'P0002';
  end if;
  return v_attempt;
end;
$$;

-- Submitting an attempt ticks the task it was started from, and a mock test
-- ticks the mock task of its week.
create function public.ot_attempts_tick_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is not null then
    perform public.ot_tick_task(new.user_id, new.task_id);
  end if;
  if new.mode = 'mock' and new.mock_test_id is not null then
    perform public.ot_tick_task(new.user_id, rt.id)
       from public.roadmap_tasks rt
       join public.ot_mock_tests m on m.id = new.mock_test_id
      where rt.course_id = new.course_id and rt.week = m.week and rt.practice ->> 'kind' = 'mock';
  end if;
  return null;
end;
$$;
create trigger ot_attempts_tick_task after update of submitted_at on public.ot_attempts
  for each row when (old.submitted_at is null and new.submitted_at is not null)
  execute function public.ot_attempts_tick_task();

------------------------------------------------------------------ privileges
revoke execute on function
  public.ot_task_for(text, text),
  public.ot_tick_task(uuid, text),
  public.ot_attempts_tick_task(),
  public.ot_task_question_ids(text, int),
  public.ot_task_answer_counts(text),
  public.ot_answer_practice(int, jsonb, int, text, text),
  public.ot_start_task_exam(text)
from public, anon, authenticated;

grant execute on function
  public.ot_task_question_ids(text, int),
  public.ot_task_answer_counts(text),
  public.ot_answer_practice(int, jsonb, int, text, text),
  public.ot_start_task_exam(text)
to authenticated;
