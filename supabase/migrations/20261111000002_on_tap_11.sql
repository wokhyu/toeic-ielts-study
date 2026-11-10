-- Course "on-tap-11": question bank for Math / Physics / Chemistry grade 11,
-- migrated from the former on-tap-11 app (Next.js + SQLite).
--
-- Answer keys and worked solutions live in ot_question_keys, which learners
-- cannot read. Learners only see them through the functions below: after
-- answering in practice mode, or after submitting an exam.

create table public.ot_subjects (
  id int primary key,
  slug text not null unique,
  name text not null,
  sort int not null default 0
);

create table public.ot_chapters (
  id int primary key,
  subject_id int not null references public.ot_subjects (id),
  slug text not null,
  name text not null,
  sort int not null default 0,
  unique (subject_id, slug)
);

create table public.ot_topics (
  id int primary key,
  chapter_id int not null references public.ot_chapters (id),
  slug text not null,
  name text not null,
  sort int not null default 0,
  unique (chapter_id, slug)
);

create table public.ot_sources (
  id int primary key,
  path text not null unique,
  subject_id int not null references public.ot_subjects (id),
  title text not null default ''
);

create table public.ot_questions (
  id int primary key,
  topic_id int references public.ot_topics (id),
  source_id int not null references public.ot_sources (id),
  number_in_source int not null default 0,
  type text not null check (type in ('mcq', 'truefalse', 'short', 'essay')),
  stem_html text not null,
  difficulty int not null default 2,
  status text not null default 'ok' check (status in ('ok', 'needs_review', 'hidden')),
  flags jsonb,
  content_hash text not null unique
);
create index ot_questions_topic on public.ot_questions (topic_id, status);
create index ot_questions_type on public.ot_questions (type);

create table public.ot_question_keys (
  question_id int primary key references public.ot_questions (id) on delete cascade,
  answer_key jsonb,
  answer_source text,
  solution_html text not null default ''
);

create table public.ot_options (
  id int primary key,
  question_id int not null references public.ot_questions (id) on delete cascade,
  label text not null,
  html text not null,
  sort int not null default 0
);
create index ot_options_question on public.ot_options (question_id);

create table public.ot_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('exam')),
  config jsonb,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  score int,
  max_score int
);
create index ot_attempts_user on public.ot_attempts (user_id, started_at);

create table public.ot_attempt_answers (
  attempt_id bigint not null references public.ot_attempts (id) on delete cascade,
  question_id int not null references public.ot_questions (id),
  sort int not null default 0,
  response jsonb,
  is_correct boolean,
  score int,
  answered_at timestamptz,
  primary key (attempt_id, question_id)
);

create table public.ot_question_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id int not null references public.ot_questions (id) on delete cascade,
  seen int not null default 0,
  correct int not null default 0,
  last_seen_at timestamptz,
  primary key (user_id, question_id)
);

create table public.ot_bookmarks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  question_id int not null references public.ot_questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

------------------------------------------------------------------ RLS
alter table public.ot_subjects enable row level security;
alter table public.ot_chapters enable row level security;
alter table public.ot_topics enable row level security;
alter table public.ot_sources enable row level security;
alter table public.ot_questions enable row level security;
alter table public.ot_question_keys enable row level security;
alter table public.ot_options enable row level security;
alter table public.ot_attempts enable row level security;
alter table public.ot_attempt_answers enable row level security;
alter table public.ot_question_stats enable row level security;
alter table public.ot_bookmarks enable row level security;

create policy "enrolled or admin" on public.ot_subjects
  for select to authenticated using (public.is_enrolled('on-tap-11') or public.is_admin());
create policy "enrolled or admin" on public.ot_chapters
  for select to authenticated using (public.is_enrolled('on-tap-11') or public.is_admin());
create policy "enrolled or admin" on public.ot_topics
  for select to authenticated using (public.is_enrolled('on-tap-11') or public.is_admin());
create policy "enrolled or admin" on public.ot_sources
  for select to authenticated using (public.is_enrolled('on-tap-11') or public.is_admin());
create policy "enrolled see ready questions, admin sees all" on public.ot_questions
  for select to authenticated using ((status = 'ok' and public.is_enrolled('on-tap-11')) or public.is_admin());
create policy "enrolled or admin" on public.ot_options
  for select to authenticated using (public.is_enrolled('on-tap-11') or public.is_admin());
create policy "admin only" on public.ot_question_keys
  for select to authenticated using (public.is_admin());
create policy "own or admin" on public.ot_attempts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own or admin" on public.ot_attempt_answers
  for select to authenticated using (
    exists (select 1 from public.ot_attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin()))
  );
create policy "own or admin" on public.ot_question_stats
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own or admin" on public.ot_bookmarks
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- All writes go through the functions below.
revoke insert, update, delete on
  public.ot_subjects, public.ot_chapters, public.ot_topics, public.ot_sources,
  public.ot_questions, public.ot_question_keys, public.ot_options,
  public.ot_attempts, public.ot_attempt_answers, public.ot_question_stats, public.ot_bookmarks
from anon, authenticated;
revoke select on
  public.ot_subjects, public.ot_chapters, public.ot_topics, public.ot_sources,
  public.ot_questions, public.ot_question_keys, public.ot_options,
  public.ot_attempts, public.ot_attempt_answers, public.ot_question_stats, public.ot_bookmarks
from anon;

------------------------------------------------------------------ grading (port of grade.ts)
-- "12,5 cm" -> 12.5 ; null when there is no number to compare.
create function public.ot_parse_number(p_raw text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  v text;
  m text[];
begin
  v := regexp_replace(p_raw, '\s+', '', 'g');
  v := regexp_replace(v, '[^0-9.,+eE/-]', '', 'g');
  v := replace(v, ',', '.');
  if v = '' then
    return null;
  end if;
  m := regexp_match(v, '^(-?[0-9.]+)/(-?[0-9.]+)$');
  if m is not null then
    begin
      if m[2]::numeric <> 0 then
        return m[1]::numeric / m[2]::numeric;
      end if;
    exception when others then
      null;
    end;
  end if;
  begin
    return v::numeric;
  exception when others then
    return null;
  end;
end;
$$;

-- Points are scaled by 100 so partial Dung/Sai credit stays an integer.
-- score/is_correct are null when the question cannot be graded automatically.
create function public.ot_grade(p_type text, p_key jsonb, p_response jsonb, out score int, out is_correct boolean)
language plpgsql immutable set search_path = '' as $$
declare
  v_picked text;
  v_want text;
  v_given text;
  v_label text;
  v_hits int := 0;
  v_n int := 0;
  a numeric;
  b numeric;
begin
  if p_type = 'essay' or p_key is null or jsonb_typeof(p_key) = 'null' then
    score := null;
    is_correct := null;
    return;
  end if;

  if p_type = 'mcq' then
    v_picked := case when jsonb_typeof(p_response) = 'string' then upper(btrim(p_response #>> '{}')) else '' end;
    v_want := upper(btrim(p_key #>> '{}'));
    is_correct := v_picked <> '' and v_picked = v_want;
    score := case when is_correct then 100 else 0 end;
    return;
  end if;

  if p_type = 'truefalse' then
    for v_label in select jsonb_object_keys(p_key) loop
      v_n := v_n + 1;
      if jsonb_typeof(p_response) = 'object' and p_response ? v_label
         and (p_response -> v_label) = (p_key -> v_label) then
        v_hits := v_hits + 1;
      end if;
    end loop;
    score := case
      when v_n = 4 then (array[0, 10, 25, 50, 100])[v_hits + 1]
      else round(v_hits::numeric / greatest(v_n, 1) * 100)::int
    end;
    is_correct := v_hits = v_n;
    return;
  end if;

  -- short answer
  v_given := case when jsonb_typeof(p_response) = 'string' then btrim(p_response #>> '{}') else '' end;
  v_want := btrim(p_key #>> '{}');
  if v_given = '' then
    score := 0;
    is_correct := false;
    return;
  end if;
  a := public.ot_parse_number(v_given);
  b := public.ot_parse_number(v_want);
  if a is not null and b is not null then
    is_correct := abs(a - b) <= 0.000001 * greatest(1, abs(a), abs(b));
  else
    is_correct := lower(regexp_replace(v_given, '\s+', '', 'g')) = lower(regexp_replace(v_want, '\s+', '', 'g'));
  end if;
  score := case when is_correct then 100 else 0 end;
end;
$$;

create function public.ot_require_enrolled() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.is_enrolled('on-tap-11') or public.is_admin()) then
    raise exception 'not enrolled in on-tap-11' using errcode = '42501';
  end if;
end;
$$;

-- Keys must stay hidden while the caller has an unsubmitted exam containing the question.
create function public.ot_require_not_in_open_exam(p_question int) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.ot_attempts a
      join public.ot_attempt_answers aa on aa.attempt_id = a.id
     where a.user_id = auth.uid() and a.submitted_at is null and aa.question_id = p_question
  ) then
    raise exception 'question is part of an exam in progress' using errcode = '42501';
  end if;
end;
$$;

create function public.ot_bump_stats(p_user uuid, p_question int, p_correct boolean) returns void
language sql security definer set search_path = '' as $$
  insert into public.ot_question_stats (user_id, question_id, seen, correct, last_seen_at)
  values (p_user, p_question, 1, case when p_correct then 1 else 0 end, now())
  on conflict (user_id, question_id) do update set
    seen = public.ot_question_stats.seen + 1,
    correct = public.ot_question_stats.correct + excluded.correct,
    last_seen_at = excluded.last_seen_at;
$$;

------------------------------------------------------------------ learner functions
-- Subject -> chapter -> topic rows with the caller's progress.
create function public.ot_topic_tree()
returns table (
  subject_id int, subject_slug text, subject_name text,
  chapter_id int, chapter_name text,
  topic_id int, topic_slug text, topic_name text,
  total bigint, seen bigint, correct bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.ot_require_enrolled();
  return query
  select s.id, s.slug, s.name, c.id, c.name, t.id, t.slug, t.name,
         (select count(*) from public.ot_questions q where q.topic_id = t.id and q.status = 'ok'),
         (select count(*) from public.ot_question_stats qs join public.ot_questions q on q.id = qs.question_id
           where qs.user_id = auth.uid() and q.topic_id = t.id and qs.seen > 0),
         (select count(*) from public.ot_question_stats qs join public.ot_questions q on q.id = qs.question_id
           where qs.user_id = auth.uid() and q.topic_id = t.id and qs.correct > 0)
    from public.ot_subjects s
    join public.ot_chapters c on c.subject_id = s.id
    join public.ot_topics t on t.chapter_id = c.id
   order by s.sort, c.sort, t.sort;
end;
$$;

-- Question ids for a topic, unseen ones first so practice keeps moving.
create function public.ot_topic_question_ids(p_topic int, p_limit int default 20, p_offset int default 0)
returns setof int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ot_require_enrolled();
  return query
  select q.id from public.ot_questions q
    left join public.ot_question_stats qs on qs.question_id = q.id and qs.user_id = auth.uid()
   where q.topic_id = p_topic and q.status = 'ok'
   order by coalesce(qs.seen, 0), q.number_in_source, q.id
   limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
end;
$$;

create function public.ot_answer_practice(p_question int, p_response jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_type text;
  v_key jsonb;
  v_solution text;
  g record;
begin
  perform public.ot_require_enrolled();
  perform public.ot_require_not_in_open_exam(p_question);
  select q.type, k.answer_key, coalesce(k.solution_html, '')
    into v_type, v_key, v_solution
    from public.ot_questions q left join public.ot_question_keys k on k.question_id = q.id
   where q.id = p_question and q.status = 'ok';
  if not found then
    raise exception 'question % not found', p_question using errcode = 'P0002';
  end if;
  select * into g from public.ot_grade(v_type, v_key, p_response);
  perform public.ot_bump_stats(auth.uid(), p_question, g.is_correct);
  return jsonb_build_object('score', g.score, 'is_correct', g.is_correct, 'answer_key', v_key, 'solution_html', v_solution);
end;
$$;

-- Answer key and solution for a question the caller has already answered (used by the review page).
create function public.ot_reveal(p_question int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform public.ot_require_enrolled();
  perform public.ot_require_not_in_open_exam(p_question);
  if not public.is_admin() and not exists (
    select 1 from public.ot_question_stats where user_id = auth.uid() and question_id = p_question and seen > 0
  ) then
    raise exception 'answer the question first' using errcode = '42501';
  end if;
  select jsonb_build_object('answer_key', k.answer_key, 'solution_html', k.solution_html) into v
    from public.ot_question_keys k where k.question_id = p_question;
  return coalesce(v, jsonb_build_object('answer_key', null, 'solution_html', ''));
end;
$$;

create function public.ot_toggle_bookmark(p_question int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ot_require_enrolled();
  delete from public.ot_bookmarks where user_id = auth.uid() and question_id = p_question;
  if found then
    return false;
  end if;
  insert into public.ot_bookmarks (user_id, question_id) values (auth.uid(), p_question);
  return true;
end;
$$;

create function public.ot_wrong_question_ids(p_limit int default 50) returns setof int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ot_require_enrolled();
  return query
  select qs.question_id from public.ot_question_stats qs
    join public.ot_questions q on q.id = qs.question_id
   where qs.user_id = auth.uid() and qs.seen > 0 and qs.correct = 0 and q.status = 'ok'
   order by qs.last_seen_at desc
   limit least(greatest(p_limit, 1), 200);
end;
$$;

create function public.ot_start_exam(p_topic_ids int[], p_count int, p_minutes int, p_types text[])
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_count int := least(greatest(coalesce(p_count, 20), 1), 100);
  v_minutes int := least(greatest(coalesce(p_minutes, 30), 0), 240);
  v_types text[] := coalesce(nullif(p_types, '{}'), array['mcq']);
  v_attempt bigint;
begin
  perform public.ot_require_enrolled();
  insert into public.ot_attempts (user_id, mode, config, deadline_at)
  values (
    auth.uid(), 'exam',
    jsonb_build_object('topic_ids', p_topic_ids, 'count', v_count, 'minutes', v_minutes, 'types', v_types),
    case when v_minutes > 0 then now() + make_interval(mins => v_minutes) end
  )
  returning id into v_attempt;

  insert into public.ot_attempt_answers (attempt_id, question_id, sort)
  select v_attempt, x.id, (row_number() over ())::int - 1
    from (
      select q.id from public.ot_questions q
       where q.status = 'ok' and q.topic_id = any (p_topic_ids) and q.type = any (v_types)
       order by random() limit v_count
    ) x;

  if not exists (select 1 from public.ot_attempt_answers where attempt_id = v_attempt) then
    delete from public.ot_attempts where id = v_attempt;
    raise exception 'no questions match the selected topics' using errcode = 'P0002';
  end if;
  return v_attempt;
end;
$$;

-- Questions of an exam attempt, without keys. Allowed while the attempt is open.
create function public.ot_attempt_questions(p_attempt bigint) returns setof int
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ot_attempts where id = p_attempt and (user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  return query select aa.question_id from public.ot_attempt_answers aa where aa.attempt_id = p_attempt order by aa.sort;
end;
$$;

create function public.ot_save_answer(p_attempt bigint, p_question int, p_response jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ot_attempts
     where id = p_attempt and user_id = auth.uid() and submitted_at is null
       and (deadline_at is null or now() <= deadline_at + interval '60 seconds')
  ) then
    return false;
  end if;
  update public.ot_attempt_answers set response = p_response, answered_at = now()
   where attempt_id = p_attempt and question_id = p_question;
  return found;
end;
$$;

create function public.ot_submit_exam(p_attempt bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  g record;
  v_total int := 0;
  v_max int := 0;
  v_submitted timestamptz;
begin
  select submitted_at into v_submitted from public.ot_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if v_submitted is null then
    for r in
      select aa.question_id, aa.response, q.type, k.answer_key
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
    end loop;
    update public.ot_attempts set submitted_at = now(), score = v_total, max_score = v_max where id = p_attempt;
  end if;
  return (select jsonb_build_object('score', score, 'max_score', max_score) from public.ot_attempts where id = p_attempt);
end;
$$;

-- Graded answers with keys and solutions, only after the attempt is submitted.
create function public.ot_attempt_review(p_attempt bigint)
returns table (
  question_id int, sort int, response jsonb, is_correct boolean, score int,
  answer_key jsonb, solution_html text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.ot_attempts
     where id = p_attempt and submitted_at is not null and (user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'attempt not found or not submitted' using errcode = 'P0002';
  end if;
  return query
  select aa.question_id, aa.sort, aa.response, aa.is_correct, aa.score, k.answer_key, coalesce(k.solution_html, '')
    from public.ot_attempt_answers aa
    left join public.ot_question_keys k on k.question_id = aa.question_id
   where aa.attempt_id = p_attempt
   order by aa.sort;
end;
$$;

------------------------------------------------------------------ admin functions
create function public.ot_admin_set_key(p_question int, p_key jsonb, p_status text) returns void
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
end;
$$;

------------------------------------------------------------------ function privileges
revoke execute on function
  public.ot_parse_number(text),
  public.ot_grade(text, jsonb, jsonb),
  public.ot_require_enrolled(),
  public.ot_require_not_in_open_exam(int),
  public.ot_bump_stats(uuid, int, boolean),
  public.ot_topic_tree(),
  public.ot_topic_question_ids(int, int, int),
  public.ot_answer_practice(int, jsonb),
  public.ot_reveal(int),
  public.ot_toggle_bookmark(int),
  public.ot_wrong_question_ids(int),
  public.ot_start_exam(int[], int, int, text[]),
  public.ot_attempt_questions(bigint),
  public.ot_save_answer(bigint, int, jsonb),
  public.ot_submit_exam(bigint),
  public.ot_attempt_review(bigint),
  public.ot_admin_set_key(int, jsonb, text)
from public, anon;

grant execute on function
  public.ot_topic_tree(),
  public.ot_topic_question_ids(int, int, int),
  public.ot_answer_practice(int, jsonb),
  public.ot_reveal(int),
  public.ot_toggle_bookmark(int),
  public.ot_wrong_question_ids(int),
  public.ot_start_exam(int[], int, int, text[]),
  public.ot_attempt_questions(bigint),
  public.ot_save_answer(bigint, int, jsonb),
  public.ot_submit_exam(bigint),
  public.ot_attempt_review(bigint),
  public.ot_admin_set_key(int, jsonb, text)
to authenticated;

------------------------------------------------------------------ media
-- Formula images rendered from Word. Public bucket: files are only discoverable
-- through question HTML, which RLS restricts to enrolled learners.
insert into storage.buckets (id, name, public)
values ('ot-media', 'ot-media', true)
on conflict (id) do nothing;
