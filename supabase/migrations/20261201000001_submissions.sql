-- IELTS Writing and Speaking work, and peer review between classmates.
--
--   submissions    one Writing answer (text) or one Speaking session (audio
--                  files in the private "speaking" bucket); the owner decides
--                  whether classmates may see it (shared)
--   peer_reviews   a classmate's band per criterion and a comment; one review
--                  per reviewer and submission, never on one's own work
--
-- Roadmap tasks with a "writing", "speaking" or "review" link tick themselves
-- when the answer is submitted, the recording is saved or the review is posted.

------------------------------------------------------------------ roadmap links
alter table public.roadmap_tasks drop constraint roadmap_tasks_practice_check;
alter table public.roadmap_tasks add constraint roadmap_tasks_practice_check check (
  practice is null
  or (
    jsonb_typeof(practice) = 'object'
    and practice ->> 'kind' in ('practice', 'exam', 'mock', 'writing', 'speaking', 'review')
  )
);

------------------------------------------------------------------ helpers
-- IELTS rounding of the mean of criterion bands to the nearest half band
-- (x.25 rounds up to x.5, x.75 up to the next whole band).
create function public.ielts_round(p_value numeric) returns numeric
language sql immutable set search_path = '' as $$
  select floor(p_value * 2 + 0.5) / 2;
$$;

-- Words in a text, counted the way the editor counts them.
create function public.word_count(p_text text) returns int
language sql immutable set search_path = '' as $$
  select case when btrim(coalesce(p_text, '')) = '' then 0
              else array_length(regexp_split_to_array(btrim(p_text), '\s+'), 1) end;
$$;

------------------------------------------------------------------ submissions
create table public.submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  kind text not null check (kind in ('writing', 'speaking')),
  prompt_id text not null check (prompt_id ~ '^[a-z0-9-]{1,40}$'),
  task_id text references public.roadmap_tasks (id) on delete set null,
  text text check (char_length(text) <= 20000),
  word_count int not null default 0 check (word_count >= 0),
  -- Speaking: [{"part": 1-3, "question": "...", "path": "<user>/<submission>/<n>.webm", "seconds": n}]
  audio jsonb not null default '[]' check (jsonb_typeof(audio) = 'array' and jsonb_array_length(audio) <= 20),
  seconds int check (seconds between 0 and 14400),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'writing') = (text is not null))
);
create index submissions_user on public.submissions (user_id, created_at);
create index submissions_course on public.submissions (course_id, created_at);
create index submissions_task on public.submissions (task_id) where task_id is not null;

comment on table public.submissions is
  'IELTS Writing answers and Speaking sessions. Classmates see a submission only when its owner shares it.';
comment on column public.submissions.prompt_id is 'Id in content/prompts/ielts-writing.json (w..) or ielts-speaking.json (s..).';
comment on column public.submissions.word_count is 'Set by the database from text.';
comment on column public.submissions.audio is
  'Speaking recordings: [{part, question, path, seconds}]; path is inside the private "speaking" bucket.';
comment on column public.submissions.seconds is 'Writing: time spent writing. Speaking: total length of the recordings.';
comment on column public.submissions.shared is 'Shared with classmates of the course for peer review.';
comment on column public.submissions.task_id is 'Roadmap task the work was done for ("Làm ngay").';

-- Server-side fields: word count, timestamps, and paths that must sit in the owner's folder.
create function public.submissions_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.word_count := case when new.kind = 'writing' then public.word_count(new.text) else 0 end;
  new.updated_at := now();
  if exists (
    select 1 from jsonb_array_elements(new.audio) a
     where jsonb_typeof(a) <> 'object'
        or coalesce(a ->> 'path', '') not like new.user_id::text || '/' || new.id::text || '/%'
  ) then
    raise exception 'audio paths must be <user>/<submission>/<file>' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger submissions_prepare before insert or update on public.submissions
  for each row execute function public.submissions_prepare();

alter table public.submissions enable row level security;
create policy "own, shared with classmates, or admin" on public.submissions
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (shared and public.is_enrolled(course_id))
  );
create policy "write own while enrolled" on public.submissions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_enrolled(course_id));
create policy "update own" on public.submissions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own" on public.submissions
  for delete to authenticated using (user_id = (select auth.uid()));
-- The owner may change only whether it is shared, and add recordings.
revoke update on public.submissions from anon, authenticated;
grant update (shared, audio, seconds) on public.submissions to authenticated;
revoke all on public.submissions from anon;

------------------------------------------------------------------ peer reviews
create table public.peer_reviews (
  id bigint generated always as identity primary key,
  submission_id bigint not null references public.submissions (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id text references public.roadmap_tasks (id) on delete set null,
  -- {"TR": 6, "CC": 5.5, "LR": 6, "GRA": 5}: four IELTS criteria, bands 0-9 in half bands
  scores jsonb not null,
  overall numeric(2, 1) not null default 0,
  comment text not null check (char_length(btrim(comment)) between 10 and 4000),
  created_at timestamptz not null default now(),
  unique (submission_id, reviewer_id)
);
create index peer_reviews_reviewer on public.peer_reviews (reviewer_id, created_at);
create index peer_reviews_task on public.peer_reviews (task_id) where task_id is not null;

comment on table public.peer_reviews is 'A classmate''s review of a shared submission: a band per criterion and a comment.';
comment on column public.peer_reviews.scores is
  'Bands per criterion. Writing: TA (Task 1) or TR (Task 2), CC, LR, GRA. Speaking: FC, LR, GRA, P.';
comment on column public.peer_reviews.overall is 'Mean of the four bands, rounded the IELTS way; set by the database.';

-- Who may review a submission: an enrolled classmate, on shared work that is not their own.
create function public.can_review(p_submission bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submissions s
     where s.id = p_submission and s.shared and s.user_id <> auth.uid() and public.is_enrolled(s.course_id)
  );
$$;

create function public.peer_reviews_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  v_keys text[];
  v_allowed text[];
begin
  select kind into v_kind from public.submissions where id = new.submission_id;
  v_allowed := case when v_kind = 'speaking' then array['FC', 'LR', 'GRA', 'P']
                    else array['TA', 'TR', 'CC', 'LR', 'GRA'] end;
  v_keys := array(select jsonb_object_keys(new.scores));
  if jsonb_typeof(new.scores) <> 'object' or cardinality(v_keys) <> 4 or not v_keys <@ v_allowed
     or ('TA' = any (v_keys) and 'TR' = any (v_keys))
     or exists (
       select 1 from jsonb_each(new.scores) e
        where jsonb_typeof(e.value) <> 'number'
           or (e.value)::numeric not between 0 and 9
           or (e.value)::numeric * 2 <> floor((e.value)::numeric * 2)
     ) then
    raise exception 'scores must give the four % criteria a band from 0 to 9 in half bands', v_kind
      using errcode = '22023';
  end if;
  new.overall := public.ielts_round((select avg(value::numeric) from jsonb_each_text(new.scores)));
  return new;
end;
$$;
create trigger peer_reviews_prepare before insert or update on public.peer_reviews
  for each row execute function public.peer_reviews_prepare();

alter table public.peer_reviews enable row level security;
create policy "reviewer, author, classmates who can see the work, or admin" on public.peer_reviews
  for select to authenticated using (
    reviewer_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.submissions s where s.id = submission_id)
  );
create policy "review classmates' shared work" on public.peer_reviews
  for insert to authenticated
  with check (reviewer_id = (select auth.uid()) and public.can_review(submission_id));
create policy "delete own review" on public.peer_reviews
  for delete to authenticated using (reviewer_id = (select auth.uid()));
revoke update on public.peer_reviews from anon, authenticated;
revoke all on public.peer_reviews from anon;

------------------------------------------------------------------ ticking roadmap tasks
create function public.submissions_tick_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is not null
     and (new.kind = 'writing' or jsonb_array_length(new.audio) > 0)
     and exists (
       select 1 from public.roadmap_tasks rt
        where rt.id = new.task_id and rt.course_id = new.course_id and rt.practice ->> 'kind' = new.kind
     ) then
    perform public.ot_tick_task(new.user_id, new.task_id);
  end if;
  return null;
end;
$$;
create trigger submissions_tick_task after insert or update of audio on public.submissions
  for each row execute function public.submissions_tick_task();

create function public.peer_reviews_tick_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.task_id is not null and exists (
    select 1 from public.roadmap_tasks rt
      join public.submissions s on s.id = new.submission_id and s.course_id = rt.course_id
     where rt.id = new.task_id and rt.practice ->> 'kind' = 'review'
  ) then
    perform public.ot_tick_task(new.reviewer_id, new.task_id);
  end if;
  return null;
end;
$$;
create trigger peer_reviews_tick_task after insert on public.peer_reviews
  for each row execute function public.peer_reviews_tick_task();

------------------------------------------------------------------ lists with names
-- Profiles are private, so lists that show who wrote or reviewed what go through these.

-- Submissions the caller can see in a course (their own, classmates' shared ones;
-- an admin sees all), newest first, with the author's name and review summary.
-- p_scope: 'mine', 'others' or 'all'; p_id: just that submission.
create function public.submission_list(p_course text, p_scope text default 'all', p_id bigint default null)
returns table (
  id bigint,
  user_id uuid,
  author text,
  kind text,
  prompt_id text,
  word_count int,
  seconds int,
  shared boolean,
  created_at timestamptz,
  reviews int,
  peer_overall numeric,
  reviewed_by_me boolean
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id, p.display_name, s.kind, s.prompt_id, s.word_count, s.seconds, s.shared, s.created_at,
         count(r.id)::int,
         public.ielts_round(avg(r.overall)),
         coalesce(bool_or(r.reviewer_id = auth.uid()), false)
    from public.submissions s
    join public.profiles p on p.id = s.user_id
    left join public.peer_reviews r on r.submission_id = s.id
   where s.course_id = p_course
     and (s.user_id = auth.uid() or public.is_admin() or (s.shared and public.is_enrolled(s.course_id)))
     and case p_scope
           when 'mine' then s.user_id = auth.uid()
           when 'others' then s.user_id <> auth.uid()
           else true
         end
     and (p_id is null or s.id = p_id)
   group by s.id, p.display_name
   order by s.created_at desc
   limit 200;
$$;

-- Reviews of one submission the caller can see, with reviewer names.
create function public.submission_reviews(p_submission bigint)
returns table (
  id bigint,
  reviewer_id uuid,
  reviewer text,
  scores jsonb,
  overall numeric,
  comment text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reviewer_id, p.display_name, r.scores, r.overall, r.comment, r.created_at
    from public.peer_reviews r
    join public.submissions s on s.id = r.submission_id
    join public.profiles p on p.id = r.reviewer_id
   where r.submission_id = p_submission
     and (s.user_id = auth.uid() or public.is_admin() or (s.shared and public.is_enrolled(s.course_id)))
   order by r.created_at;
$$;

------------------------------------------------------------------ speaking recordings
-- Private bucket: files live under <user>/<submission>/. The owner uploads and
-- deletes; classmates may play recordings of shared submissions; admins all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speaking', 'speaking', false, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.speaking_file_visible(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submissions s
     where s.kind = 'speaking' and s.shared and public.is_enrolled(s.course_id)
       and s.audio @> jsonb_build_array(jsonb_build_object('path', p_name))
  );
$$;

create policy "speaking: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'speaking' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "speaking: own, shared or admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'speaking'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
      or public.speaking_file_visible(name)
    )
  );
create policy "speaking: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'speaking' and (storage.foldername(name))[1] = (select auth.uid())::text);

------------------------------------------------------------------ privileges
revoke execute on function
  public.ielts_round(numeric),
  public.word_count(text),
  public.submissions_prepare(),
  public.peer_reviews_prepare(),
  public.submissions_tick_task(),
  public.peer_reviews_tick_task(),
  public.can_review(bigint),
  public.speaking_file_visible(text),
  public.submission_list(text, text, bigint),
  public.submission_reviews(bigint)
from public, anon, authenticated;

grant execute on function
  public.can_review(bigint),
  public.speaking_file_visible(text),
  public.submission_list(text, text, bigint),
  public.submission_reviews(bigint)
to authenticated;
