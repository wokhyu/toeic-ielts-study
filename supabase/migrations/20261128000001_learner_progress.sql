-- Learner progress: streaks from all activity, a progress summary, badges and
-- the spaced review list of missed questions.
--
--   learner_streak(user, course)   current and longest run of study days (Vietnam dates)
--   learner_progress(course, user) everything the "Tiến bộ" tab draws, as one JSON object;
--                                  admins may pass another learner's id
--   learner_achievements(course)   awards badges the learner has newly earned and lists them
--   ot_due_review_ids / ot_dismiss_review  the review list driven by ot_question_stats.next_due
--   get_leaderboard                streak now counts any study activity, plus a badge count

------------------------------------------------------------------ streaks
-- A study day is any day with an answer, a ticked task or a flashcard review.
-- The current streak ends today or yesterday; otherwise it is 0.
create function public.learner_streak(p_user uuid, p_course text)
returns table (current_streak int, longest_streak int, active_days int, last_day date)
language sql stable security definer set search_path = '' as $$
  with days as (
    select distinct a.day as d from public.learner_activity a
     where a.user_id = p_user and a.course_id = p_course
  ),
  runs as (
    select count(*)::int as len, max(d) as last_d
      from (select d, d - (row_number() over (order by d))::int as grp from days) x
     group by grp
  )
  select coalesce((select r.len from runs r where r.last_d >= public.vn_today() - 1 order by r.last_d desc limit 1), 0),
         coalesce((select max(len) from runs), 0),
         (select count(*)::int from days),
         (select max(d) from days);
$$;

------------------------------------------------------------------ progress summary
create function public.learner_progress(p_course text, p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_today date := public.vn_today();
  v_since timestamptz := now() - interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_user <> auth.uid() and not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_user = auth.uid() then
    perform public.ot_require_course(p_course);
  end if;

  return jsonb_build_object(
    'today', v_today,
    'streak', (select to_jsonb(s) from public.learner_streak(v_user, p_course) s),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'answers', d.answers, 'tasks', d.tasks, 'cards', d.cards)
                       order by d.day)
        from (
          select a.day,
                 count(*) filter (where a.kind in ('practice', 'review', 'exam', 'mock')) as answers,
                 count(*) filter (where a.kind = 'task') as tasks,
                 count(*) filter (where a.kind = 'flashcard') as cards
            from public.learner_activity a
           where a.user_id = v_user and a.course_id = p_course and a.day > v_today - 140
           group by a.day
        ) d
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'answers', count(*) filter (where r.is_correct is not null),
        'correct', count(*) filter (where r.is_correct),
        'answers_30d', count(*) filter (where r.is_correct is not null and r.created_at >= v_since),
        'correct_30d', count(*) filter (where r.is_correct and r.created_at >= v_since),
        'median_time_ms', percentile_cont(0.5) within group (order by r.time_ms)
                            filter (where r.time_ms is not null and r.mode in ('practice', 'review')),
        'tasks', (select count(*) from public.task_progress tp where tp.user_id = v_user and tp.course_id = p_course),
        'task_minutes', (
          select coalesce(sum(rt.minutes), 0) from public.task_progress tp
            join public.roadmap_tasks rt on rt.id = tp.task_id
           where tp.user_id = v_user and tp.course_id = p_course
        ),
        'cards', (
          select count(*) from public.flashcard_review_log f where f.user_id = v_user and f.course_id = p_course
        ),
        'due_reviews', (
          select count(*) from public.ot_question_stats qs join public.ot_questions q on q.id = qs.question_id
           where qs.user_id = v_user and q.course_id = p_course and q.status = 'ok' and q.pool = 'practice'
             and qs.next_due <= v_today
        )
      )
        from public.ot_responses r
       where r.user_id = v_user and r.course_id = p_course
    ),
    'by_chapter', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.chapter_id, 'name', x.chapter_name, 'section', x.section_name,
               'n', x.n, 'correct', x.correct, 'n_30d', x.n30, 'correct_30d', x.correct30)
             order by x.section_sort, x.chapter_sort)
        from (
          select c.id as chapter_id, c.name as chapter_name, s.name as section_name,
                 s.sort as section_sort, c.sort as chapter_sort,
                 count(*) as n, count(*) filter (where r.is_correct) as correct,
                 count(*) filter (where r.created_at >= v_since) as n30,
                 count(*) filter (where r.is_correct and r.created_at >= v_since) as correct30
            from public.ot_responses r
            join public.ot_questions q on q.id = r.question_id
            join public.ot_topics t on t.id = q.topic_id
            join public.ot_chapters c on c.id = t.chapter_id
            join public.ot_subjects s on s.id = c.subject_id
           where r.user_id = v_user and r.course_id = p_course and r.is_correct is not null
           group by c.id, c.name, s.name, s.sort, c.sort
        ) x
    ), '[]'::jsonb),
    'by_tag', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tag', x.tag, 'n', x.n, 'correct', x.correct, 'n_30d', x.n30, 'correct_30d', x.correct30)
             order by x.tag)
        from (
          select tag, count(*) as n, count(*) filter (where r.is_correct) as correct,
                 count(*) filter (where r.created_at >= v_since) as n30,
                 count(*) filter (where r.is_correct and r.created_at >= v_since) as correct30
            from public.ot_responses r
            join public.ot_questions q on q.id = r.question_id
            cross join lateral unnest(q.tags) as tag
           where r.user_id = v_user and r.course_id = p_course and r.is_correct is not null
           group by tag
        ) x
    ), '[]'::jsonb),
    'mock_scores', coalesce((
      select jsonb_agg(jsonb_build_object(
               'taken_at', m.taken_at, 'week', m.week, 'total', m.total, 'listening', m.listening,
               'reading', m.reading, 'writing', m.writing, 'speaking', m.speaking, 'source', m.source)
             order by m.taken_at, m.id)
        from public.mock_scores m where m.user_id = v_user and m.course_id = p_course
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.badge_id, 'awarded_at', a.awarded_at) order by a.awarded_at)
        from public.achievements a where a.user_id = v_user and a.course_id = p_course
    ), '[]'::jsonb)
  );
end;
$$;

------------------------------------------------------------------ badges
-- The list of badges lives in src/content/badges.ts too (names, descriptions,
-- which courses show them); a test checks that both lists have the same ids.
create function public.learner_achievements(p_course text)
returns table (badge_id text, awarded_at timestamptz, is_new boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_answers int;
  v_correct int;
  v_longest int;
  v_cards int;
  v_graded_mocks int;
  v_first numeric;
  v_last numeric;
  v_week_done boolean;
  v_part_master boolean;
  v_reviewed int;
  v_track text;
begin
  perform public.ot_require_course(p_course);

  select count(*) filter (where r.is_correct is not null), count(*) filter (where r.is_correct)
    into v_answers, v_correct
    from public.ot_responses r where r.user_id = v_user and r.course_id = p_course;
  select s.longest_streak into v_longest from public.learner_streak(v_user, p_course) s;
  select count(*) into v_cards from public.flashcard_review_log f where f.user_id = v_user and f.course_id = p_course;
  select count(*) filter (where m.source = 'mock_test') into v_graded_mocks
    from public.mock_scores m where m.user_id = v_user and m.course_id = p_course;
  select (array_agg(m.total order by m.taken_at, m.id))[1], (array_agg(m.total order by m.taken_at desc, m.id desc))[1]
    into v_first, v_last
    from public.mock_scores m where m.user_id = v_user and m.course_id = p_course
  having count(*) >= 2;
  select e.track into v_track from public.enrollments e where e.user_id = v_user and e.course_id = p_course;
  select exists (
    select 1 from public.roadmap_tasks rt
      left join public.task_progress tp on tp.task_id = rt.id and tp.user_id = v_user
     where rt.course_id = p_course and rt.week is not null and v_track is not null
       and rt.track in ('all', v_track)
     group by rt.week
    having count(*) = count(tp.task_id)
  ) into v_week_done;
  select exists (
    select 1 from public.ot_responses r
      join public.ot_questions q on q.id = r.question_id
      join public.ot_topics t on t.id = q.topic_id
     where r.user_id = v_user and r.course_id = p_course and r.is_correct is not null
     group by t.chapter_id
    having count(*) >= 40 and count(*) filter (where r.is_correct) >= 0.8 * count(*)
  ) into v_part_master;
  select count(*) into v_reviewed
    from public.ot_question_stats qs join public.ot_questions q on q.id = qs.question_id
   where qs.user_id = v_user and q.course_id = p_course
     and qs.last_wrong_at is not null and qs.next_due is null and qs.correct_streak >= 3;

  return query
  with earned(id) as (
    select b.id from (values
      -- badges:start
      ('first-step', v_answers >= 1),
      ('correct-100', v_correct >= 100),
      ('correct-500', v_correct >= 500),
      ('streak-7', v_longest >= 7),
      ('streak-30', v_longest >= 30),
      ('week-done', coalesce(v_week_done, false)),
      ('cards-100', v_cards >= 100),
      ('first-mock', v_graded_mocks >= 1),
      ('level-up', coalesce(v_last - v_first >= case when p_course = 'ielts' then 0.5 else 50 end, false)),
      ('part-master', coalesce(v_part_master, false)),
      ('review-10', v_reviewed >= 10)
      -- badges:end
    ) as b(id, ok)
    where b.ok
  ),
  added as (
    insert into public.achievements as a (user_id, course_id, badge_id)
    select v_user, p_course, e.id from earned e
    on conflict (user_id, course_id, badge_id) do nothing
    returning a.badge_id
  )
  select a.badge_id, a.awarded_at, false
    from public.achievements a
   where a.user_id = v_user and a.course_id = p_course
  union all
  select ad.badge_id, now(), true from added ad;
end;
$$;

------------------------------------------------------------------ review list
-- Missed questions that are due today (Vietnam date), oldest due first.
create function public.ot_due_review_ids(p_course text, p_limit int default 20)
returns setof int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ot_require_course(p_course);
  return query
  select qs.question_id from public.ot_question_stats qs
    join public.ot_questions q on q.id = qs.question_id
   where qs.user_id = auth.uid() and q.course_id = p_course and q.status = 'ok' and q.pool = 'practice'
     and qs.next_due <= public.vn_today()
   order by qs.next_due, qs.last_wrong_at
   limit least(greatest(p_limit, 1), 100);
end;
$$;

-- "Đã hiểu": take a question off the review list without answering it again.
create function public.ot_dismiss_review(p_question int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.ot_question_stats set next_due = null
   where user_id = auth.uid() and question_id = p_question and next_due is not null;
  return found;
end;
$$;

------------------------------------------------------------------ leaderboard
drop function public.get_leaderboard(text);
-- Approved members of one course: tasks done, study days, current streak (any
-- study activity, Vietnam dates) and number of badges.
create function public.get_leaderboard(p_course text)
returns table (
  user_id uuid,
  display_name text,
  track text,
  tasks_done bigint,
  active_days int,
  streak int,
  last_active date,
  badges int
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (public.is_enrolled(p_course) or public.is_admin()) then
    raise exception 'not enrolled in %', p_course using errcode = '42501';
  end if;
  return query
  select e.user_id, p.display_name, e.track,
         (select count(*) from public.task_progress tp where tp.user_id = e.user_id and tp.course_id = p_course),
         s.active_days, s.current_streak, s.last_day,
         (select count(*)::int from public.achievements a where a.user_id = e.user_id and a.course_id = p_course)
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    cross join lateral public.learner_streak(e.user_id, p_course) s
   where e.course_id = p_course and e.status = 'approved'
   order by 6 desc, 4 desc, p.display_name;
end;
$$;

------------------------------------------------------------------ privileges
revoke execute on function
  public.learner_streak(uuid, text),
  public.learner_progress(text, uuid),
  public.learner_achievements(text),
  public.ot_due_review_ids(text, int),
  public.ot_dismiss_review(int),
  public.get_leaderboard(text)
from public, anon, authenticated;

grant execute on function
  public.learner_progress(text, uuid),
  public.learner_achievements(text),
  public.ot_due_review_ids(text, int),
  public.ot_dismiss_review(int),
  public.get_leaderboard(text)
to authenticated;
