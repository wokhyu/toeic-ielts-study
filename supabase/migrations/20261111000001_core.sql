-- Core: courses, profiles with roles, enrollments approved by an admin,
-- and per-user progress for the roadmap courses (TOEIC, IELTS).
--
-- Supabase grants ALL on new public tables to anon/authenticated by default.
-- Every table below enables RLS, and write paths that need extra rules
-- go through SECURITY DEFINER functions instead of direct table writes.

------------------------------------------------------------------ courses
create table public.courses (
  id text primary key,
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('roadmap', 'question_bank')),
  sort int not null default 0
);

insert into public.courses (id, title, description, kind, sort) values
  ('toeic', 'TOEIC Listening & Reading', 'Lộ trình 12 tuần, 3 nhánh A/B/C, có bài test đầu vào, flashcard và thi thử.', 'roadmap', 1),
  ('ielts', 'IELTS Academic', 'Lộ trình 12 tuần luyện 4 kỹ năng, chấm chéo Writing và luyện Speaking theo cặp.', 'roadmap', 2),
  ('on-tap-11', 'Ôn tập Toán · Lý · Hóa 11', 'Ngân hàng câu hỏi theo chương: luyện tập từng chủ đề, thi thử có bấm giờ, ôn lại câu sai.', 'question_bank', 3);

alter table public.courses enable row level security;
create policy "courses are readable by signed-in users" on public.courses
  for select to authenticated using (true);
revoke insert, update, delete on public.courses from anon, authenticated;

------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'learner' check (role in ('learner', 'admin')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
create policy "own profile or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Learners may only change their display name; role changes go through admin_set_role().
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

------------------------------------------------------------------ enrollments
create table public.enrollments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  track text check (track in ('A', 'B', 'C')),
  start_date date,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  primary key (user_id, course_id)
);

create function public.is_enrolled(p_course text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and course_id = p_course and status = 'approved'
  );
$$;

alter table public.enrollments enable row level security;
create policy "own enrollments or admin" on public.enrollments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "learner sets own track and start date once approved" on public.enrollments
  for update to authenticated
  using (user_id = auth.uid() and status = 'approved')
  with check (user_id = auth.uid() and status = 'approved');

revoke insert, update, delete on public.enrollments from anon, authenticated;
grant update (track, start_date) on public.enrollments to authenticated;

-- Learner asks to join a course. Re-asking after a rejection puts the request back to pending.
create function public.request_enrollment(p_course text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'unknown course %', p_course using errcode = '22023';
  end if;
  insert into public.enrollments (user_id, course_id) values (auth.uid(), p_course)
  on conflict (user_id, course_id) do update
    set status = 'pending', requested_at = now(), decided_at = null, decided_by = null
    where public.enrollments.status in ('rejected', 'revoked')
  returning status into v_status;
  if v_status is null then
    select status into v_status from public.enrollments where user_id = auth.uid() and course_id = p_course;
  end if;
  return v_status;
end;
$$;

------------------------------------------------------------------ admin functions
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  enrollments jsonb
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, p.display_name, p.role, p.created_at, u.last_sign_in_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'course_id', e.course_id, 'status', e.status, 'track', e.track,
                     'start_date', e.start_date, 'requested_at', e.requested_at)
                   order by e.course_id)
              from public.enrollments e where e.user_id = p.id),
           '[]'::jsonb)
    from public.profiles p
    join auth.users u on u.id = p.id
   order by p.created_at desc;
end;
$$;

create function public.admin_set_enrollment(
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
end;
$$;

create function public.admin_set_role(p_user uuid, p_role text) returns void
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
end;
$$;

------------------------------------------------------------------ roadmap progress (TOEIC, IELTS)
create table public.task_progress (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  task_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, task_id),
  check (task_id like course_id || '-%')
);
create index task_progress_course on public.task_progress (course_id, user_id);

create table public.placement_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  source text not null check (source in ('test', 'real_score')),
  answers jsonb,
  correct_count int,
  total int,
  real_score numeric,
  track text not null check (track in ('A', 'B', 'C')),
  taken_at timestamptz not null default now()
);

create table public.mock_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  week int check (week between 1 and 12),
  listening numeric,
  reading numeric,
  writing numeric,
  speaking numeric,
  total numeric not null,
  taken_at date not null default current_date
);

create table public.flashcard_reviews (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  card_id text not null,
  ease numeric not null default 2.5,
  interval_days int not null default 0,
  reps int not null default 0,
  due_date date not null default current_date,
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

alter table public.task_progress enable row level security;
alter table public.placement_results enable row level security;
alter table public.mock_scores enable row level security;
alter table public.flashcard_reviews enable row level security;

create policy "read own or admin" on public.task_progress
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "write own while enrolled" on public.task_progress
  for insert to authenticated with check (user_id = auth.uid() and public.is_enrolled(course_id));
create policy "delete own" on public.task_progress
  for delete to authenticated using (user_id = auth.uid());

create policy "read own or admin" on public.placement_results
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "write own while enrolled" on public.placement_results
  for insert to authenticated with check (user_id = auth.uid() and public.is_enrolled(course_id));

create policy "read own or admin" on public.mock_scores
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "write own while enrolled" on public.mock_scores
  for insert to authenticated with check (user_id = auth.uid() and public.is_enrolled(course_id));
create policy "delete own" on public.mock_scores
  for delete to authenticated using (user_id = auth.uid());

create policy "read own or admin" on public.flashcard_reviews
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "insert own while enrolled" on public.flashcard_reviews
  for insert to authenticated with check (user_id = auth.uid() and public.is_enrolled(course_id));
create policy "update own while enrolled" on public.flashcard_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_enrolled(course_id));

revoke update on public.task_progress, public.placement_results, public.mock_scores from anon, authenticated;
revoke all on public.task_progress, public.placement_results, public.mock_scores, public.flashcard_reviews from anon;

-- Leaderboard of approved members of one roadmap course. Streak counts consecutive
-- days (Vietnam time) with at least one completed task, ending today or yesterday.
create function public.get_leaderboard(p_course text)
returns table (
  user_id uuid,
  display_name text,
  track text,
  tasks_done bigint,
  active_days bigint,
  streak int,
  last_active date
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if not (public.is_enrolled(p_course) or public.is_admin()) then
    raise exception 'not enrolled in %', p_course using errcode = '42501';
  end if;
  return query
  with members as (
    select e.user_id, e.track from public.enrollments e
     where e.course_id = p_course and e.status = 'approved'
  ),
  done as (
    select tp.user_id, count(*) as n from public.task_progress tp
     where tp.course_id = p_course group by tp.user_id
  ),
  days as (
    select distinct tp.user_id, (tp.completed_at at time zone 'Asia/Ho_Chi_Minh')::date as d
      from public.task_progress tp where tp.course_id = p_course
  ),
  islands as (
    select x.user_id, x.d, x.d - (row_number() over (partition by x.user_id order by x.d))::int as grp
      from days x
  ),
  runs as (
    select i.user_id, count(*)::int as len, max(i.d) as last_d from islands i group by i.user_id, i.grp
  ),
  latest as (
    select distinct on (r.user_id) r.user_id, r.len, r.last_d from runs r order by r.user_id, r.last_d desc
  )
  select m.user_id, p.display_name, m.track,
         coalesce(dn.n, 0),
         (select count(*) from days dd where dd.user_id = m.user_id),
         case when l.last_d >= v_today - 1 then l.len else 0 end,
         l.last_d
    from members m
    join public.profiles p on p.id = m.user_id
    left join done dn on dn.user_id = m.user_id
    left join latest l on l.user_id = m.user_id
   order by 6 desc, 4 desc, p.display_name;
end;
$$;

------------------------------------------------------------------ function privileges
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_admin(),
  public.is_enrolled(text),
  public.request_enrollment(text),
  public.admin_list_users(),
  public.admin_set_enrollment(uuid, text, text, text, date),
  public.admin_set_role(uuid, text),
  public.get_leaderboard(text)
to authenticated;
