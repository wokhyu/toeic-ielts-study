-- Admin analytics, computed straight from the learning record (ot_responses,
-- learner_activity, task_progress, mock_scores). The group is small, so plain
-- queries are fast enough and no materialized views are needed.
--
--   admin_overview(course, from, to)   class KPIs, daily activity, funnel, tracks
--   admin_learners(course)             one row per approved learner, for the learner table
--   admin_item_analysis(course, min)   item statistics: difficulty, discrimination, distractors
--
-- Admin accounts are left out of all three, so testing the site does not skew the numbers.

------------------------------------------------------------------ helpers
-- Upper end of the 95% Wilson interval for k correct out of n: used to call a
-- point weak only when even the optimistic estimate is low (same as src/lib/stats.ts).
create function public.wilson_upper(p_k bigint, p_n bigint) returns double precision
language sql immutable set search_path = '' as $$
  select case when p_n <= 0 then 1 else
    least(1, (
      (p_k::float8 / p_n + 1.96 ^ 2 / (2 * p_n))
      + 1.96 * sqrt((p_k::float8 / p_n) * (1 - p_k::float8 / p_n) / p_n + 1.96 ^ 2 / (4.0 * p_n * p_n))
    ) / (1 + 1.96 ^ 2 / p_n))
  end;
$$;

create function public.admin_require() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

------------------------------------------------------------------ class overview
create function public.admin_overview(p_course text default null, p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_to date := coalesce(p_to, public.vn_today());
  v_from date := coalesce(p_from, coalesce(p_to, public.vn_today()) - 29);
begin
  perform public.admin_require();
  if v_from > v_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  return (
    with act as (
      select a.* from public.learner_activity a
        join public.profiles pr on pr.id = a.user_id and pr.role = 'learner'
       where p_course is null or a.course_id = p_course
    ),
    ranged as (select * from act where day between v_from and v_to),
    members as (
      select e.* from public.enrollments e
        join public.profiles pr on pr.id = e.user_id and pr.role = 'learner'
       where p_course is null or e.course_id = p_course
    )
    select jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'kpis', jsonb_build_object(
        'active_7d', (select count(distinct user_id) from act where day > v_to - 7 and day <= v_to),
        'active_30d', (select count(distinct user_id) from act where day > v_to - 30 and day <= v_to),
        'active_range', (select count(distinct user_id) from ranged),
        'answers', (select count(*) from ranged where kind in ('practice', 'review', 'exam', 'mock') and is_correct is not null),
        'correct', (select count(*) from ranged where kind in ('practice', 'review', 'exam', 'mock') and is_correct),
        'tasks', (select count(*) from ranged where kind = 'task'),
        'cards', (select count(*) from ranged where kind = 'flashcard'),
        'study_minutes', (
          select round(
            coalesce((select sum(time_ms) from ranged where kind in ('practice', 'review', 'exam', 'mock')), 0) / 60000.0
            + coalesce((select sum(rt.minutes) from ranged r join public.roadmap_tasks rt on rt.id = r.ref where r.kind = 'task'), 0)
          )
        ),
        'pending', (select count(*) from members where status = 'pending')
      ),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'day', d.day, 'answers', d.answers, 'tasks', d.tasks, 'cards', d.cards, 'learners', d.learners)
               order by d.day)
          from (
            select day,
                   count(*) filter (where kind in ('practice', 'review', 'exam', 'mock')) as answers,
                   count(*) filter (where kind = 'task') as tasks,
                   count(*) filter (where kind = 'flashcard') as cards,
                   count(distinct user_id) as learners
              from ranged group by day
          ) d
      ), '[]'::jsonb),
      'funnel', jsonb_build_object(
        'requested', (select count(*) from members),
        'approved', (select count(*) from members where status = 'approved'),
        'started', (
          select count(*) from members m
           where m.status = 'approved'
             and exists (select 1 from act a where a.user_id = m.user_id and a.course_id = m.course_id)
        ),
        'active_7d', (
          select count(*) from members m
           where m.status = 'approved'
             and exists (
               select 1 from act a
                where a.user_id = m.user_id and a.course_id = m.course_id and a.day > v_to - 7 and a.day <= v_to
             )
        )
      ),
      'tracks', (
        select jsonb_build_object(
          'A', count(*) filter (where track = 'A'),
          'B', count(*) filter (where track = 'B'),
          'C', count(*) filter (where track = 'C'),
          'none', count(*) filter (where track is null)
        )
          from members where status = 'approved'
      )
    )
  );
end;
$$;

------------------------------------------------------------------ learner table
create function public.admin_learners(p_course text)
returns table (
  user_id uuid,
  display_name text,
  email text,
  track text,
  start_date date,
  last_active date,
  current_streak int,
  spark int[],
  answers_30d int,
  correct_30d int,
  tasks_done int,
  tasks_total int,
  cards_30d int,
  latest_mock numeric,
  weakest_tag text,
  weakest_n int,
  weakest_correct int
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_today date := public.vn_today();
begin
  perform public.admin_require();
  return query
  select e.user_id, p.display_name, u.email::text, e.track, e.start_date,
         s.last_day, s.current_streak,
         -- activity count for each of the last 14 days, oldest first
         (select array_agg(coalesce(c.n, 0)::int order by g.d)
            from generate_series(v_today - 13, v_today, interval '1 day') g(d)
            left join (
              select a.day, count(*) as n from public.learner_activity a
               where a.user_id = e.user_id and a.course_id = p_course and a.day > v_today - 14
               group by a.day
            ) c on c.day = g.d::date),
         (select count(*)::int from public.ot_responses r
           where r.user_id = e.user_id and r.course_id = p_course and r.is_correct is not null
             and r.created_at >= now() - interval '30 days'),
         (select count(*)::int from public.ot_responses r
           where r.user_id = e.user_id and r.course_id = p_course and r.is_correct
             and r.created_at >= now() - interval '30 days'),
         (select count(*)::int from public.task_progress tp where tp.user_id = e.user_id and tp.course_id = p_course),
         (select count(*)::int from public.roadmap_tasks rt
           where rt.course_id = p_course and rt.week is not null and e.track is not null and rt.track in ('all', e.track)),
         (select count(*)::int from public.flashcard_review_log f
           where f.user_id = e.user_id and f.course_id = p_course and f.reviewed_at >= now() - interval '30 days'),
         (select m.total from public.mock_scores m
           where m.user_id = e.user_id and m.course_id = p_course order by m.taken_at desc, m.id desc limit 1),
         w.tag, w.n::int, w.correct::int
    from public.enrollments e
    join public.profiles p on p.id = e.user_id and p.role = 'learner'
    join auth.users u on u.id = e.user_id
    cross join lateral public.learner_streak(e.user_id, p_course) s
    left join lateral (
      select t.tag, count(*) as n, count(*) filter (where r.is_correct) as correct
        from public.ot_responses r
        join public.ot_questions q on q.id = r.question_id
        cross join lateral unnest(q.tags) as t(tag)
       where r.user_id = e.user_id and r.course_id = p_course and r.is_correct is not null
         and r.created_at >= now() - interval '30 days'
       group by t.tag
      having count(*) >= 5 and count(*) filter (where r.is_correct) < 0.8 * count(*)
       order by public.wilson_upper(count(*) filter (where r.is_correct), count(*)), count(*) desc
       limit 1
    ) w on true
   where e.course_id = p_course and e.status = 'approved'
   order by s.last_day desc nulls last, p.display_name;
end;
$$;

------------------------------------------------------------------ item analysis
-- Classical test theory on each learner's FIRST answer to a question (later
-- answers are practice and would make items look easier):
--   p      share of first answers that are correct (difficulty; higher = easier)
--   r_pb   corrected point-biserial discrimination: correlation between being
--          right on this item and the learner's accuracy on all their OTHER items.
--          Positive = stronger learners get it right more often.
--   options  how many first answers chose each option (distractor analysis)
-- Flags need at least p_min first answers.
create function public.admin_item_analysis(p_course text, p_min int default 10)
returns table (
  question_id int,
  ext_id text,
  chapter text,
  topic text,
  tags text[],
  type text,
  n int,
  correct int,
  p double precision,
  r_pb double precision,
  median_time_ms double precision,
  options jsonb,
  answer_key jsonb,
  flags text[]
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_require();
  return query
  with first_answers as (
    select distinct on (r.user_id, r.question_id)
           r.user_id, r.question_id, r.is_correct, r.response, r.time_ms
      from public.ot_responses r
      join public.profiles pr on pr.id = r.user_id and pr.role = 'learner'
     where r.course_id = p_course and r.is_correct is not null
     order by r.user_id, r.question_id, r.created_at, r.id
  ),
  per_learner as (
    select f.user_id, count(*) as items, count(*) filter (where f.is_correct) as right_n
      from first_answers f group by f.user_id
  ),
  scored as (
    select f.*,
           case when l.items > 1
                then (l.right_n - case when f.is_correct then 1 else 0 end)::float8 / (l.items - 1) end as rest
      from first_answers f join per_learner l on l.user_id = f.user_id
  ),
  stats as (
    select s.question_id,
           count(*) as n,
           count(*) filter (where s.is_correct) as correct,
           corr(case when s.is_correct then 1.0 else 0.0 end, s.rest) as r_pb,
           percentile_cont(0.5) within group (order by s.time_ms) filter (where s.time_ms is not null) as med
      from scored s group by s.question_id
  ),
  picks as (
    select x.question_id, jsonb_object_agg(x.label, x.cnt) as options
      from (
        select f.question_id, f.response #>> '{}' as label, count(*) as cnt
          from first_answers f where jsonb_typeof(f.response) = 'string'
         group by 1, 2
      ) x
     group by x.question_id
  )
  select q.id, q.ext_id, c.name, t.name, q.tags, q.type,
         st.n::int, st.correct::int,
         st.correct::float8 / st.n,
         st.r_pb,
         st.med,
         coalesce(pk.options, '{}'::jsonb),
         k.answer_key,
         array_remove(array[
           case when st.n >= p_min and st.correct::float8 / st.n > 0.9 then 'too_easy' end,
           case when st.n >= p_min and st.correct::float8 / st.n < 0.2 then 'too_hard' end,
           case when st.n >= p_min and st.r_pb < 0 then 'negative_discrimination' end,
           case when st.n >= p_min and q.type = 'mcq' and exists (
             select 1 from public.ot_options o
              where o.question_id = q.id
                and o.label is distinct from (k.answer_key #>> '{}')
                and not coalesce(pk.options, '{}'::jsonb) ? o.label
           ) then 'unused_distractor' end
         ], null)
    from stats st
    join public.ot_questions q on q.id = st.question_id
    left join public.ot_topics t on t.id = q.topic_id
    left join public.ot_chapters c on c.id = t.chapter_id
    left join public.ot_question_keys k on k.question_id = q.id
    left join picks pk on pk.question_id = q.id
   order by c.sort nulls last, t.sort nulls last, q.id;
end;
$$;

------------------------------------------------------------------ privileges
revoke execute on function
  public.wilson_upper(bigint, bigint),
  public.admin_require(),
  public.admin_overview(text, date, date),
  public.admin_learners(text),
  public.admin_item_analysis(text, int)
from public, anon, authenticated;

grant execute on function
  public.admin_overview(text, date, date),
  public.admin_learners(text),
  public.admin_item_analysis(text, int)
to authenticated;
