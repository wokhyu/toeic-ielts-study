-- AI feedback on IELTS Writing, written by the "writing-feedback" Edge Function.
--
--   app_settings  small site-wide settings an admin can change (the daily AI quota)
--   ai_usage      AI requests per learner, per Vietnam day and kind
--   ai_feedback   the estimated bands and comments for one Writing submission
--
-- The function checks the caller's session, takes one unit of quota with
-- ai_quota_take() as that user, calls the model, and saves the result with the
-- service role. A failed call gives the unit back (ai_quota_refund).

------------------------------------------------------------------ settings
create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'Site-wide settings changed by admins, read by database functions.';
comment on column public.app_settings.value is 'ai_daily_quota: {"writing": n} requests per learner per Vietnam day.';

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
create policy "app_settings: admin reads" on public.app_settings
  for select to authenticated using ((select public.is_admin()));
create policy "app_settings: admin updates" on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.app_settings from anon;
revoke insert, delete on public.app_settings from authenticated;

insert into public.app_settings (key, value) values ('ai_daily_quota', '{"writing": 3}');

------------------------------------------------------------------ usage
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('writing')),
  used int not null default 0 check (used >= 0),
  primary key (user_id, day, kind)
);
comment on table public.ai_usage is 'AI feedback requests per learner and Vietnam day; written only by ai_quota_take/ai_quota_refund.';

alter table public.ai_usage enable row level security;
create policy "ai_usage: own or admin" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.ai_usage from authenticated;
revoke all on public.ai_usage from anon;

------------------------------------------------------------------ feedback
create table public.ai_feedback (
  id bigint generated always as identity primary key,
  submission_id bigint not null unique references public.submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  model text not null,
  overall numeric(2, 1) not null check (overall between 0 and 9 and overall * 2 = floor(overall * 2)),
  feedback jsonb not null check (jsonb_typeof(feedback) = 'object'),
  created_at timestamptz not null default now()
);
create index ai_feedback_user on public.ai_feedback (user_id, created_at);

comment on table public.ai_feedback is
  'AI-estimated bands and comments for a Writing submission (one per submission), saved by the writing-feedback Edge Function.';
comment on column public.ai_feedback.feedback is
  '{criteria: [{code, band, comment_vi}], overall, strengths_vi, improvements_vi, corrections: [{original, suggestion, reason_vi}], improved_paragraph}';
comment on column public.ai_feedback.model is 'Model id that wrote the feedback.';
comment on column public.ai_feedback.user_id is 'Owner of the submission.';

alter table public.ai_feedback enable row level security;
-- Private to the writer and admins; classmates see peer reviews only.
create policy "ai_feedback: own or admin" on public.ai_feedback
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.ai_feedback from authenticated;
revoke all on public.ai_feedback from anon;

------------------------------------------------------------------ quota
create function public.ai_quota_limit(p_kind text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value ->> p_kind)::int from public.app_settings where key = 'ai_daily_quota'),
    3
  );
$$;

-- Today's use and limit for the caller.
create function public.ai_quota_status(p_kind text)
returns table (used int, quota int)
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.used from public.ai_usage u
                    where u.user_id = auth.uid() and u.day = public.vn_today() and u.kind = p_kind), 0),
         public.ai_quota_limit(p_kind);
$$;

-- Takes one request from the caller's daily quota; returns how many are left.
-- Admins are not limited. Learners must be approved in IELTS.
create function public.ai_quota_take(p_kind text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_limit int := public.ai_quota_limit(p_kind);
  v_used int;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not (public.is_admin() or public.is_enrolled('ielts')) then
    raise exception 'not enrolled' using errcode = '42501';
  end if;
  insert into public.ai_usage as u (user_id, day, kind, used)
  values (v_user, public.vn_today(), p_kind, 1)
  on conflict (user_id, day, kind) do update set used = u.used + 1
  returning u.used into v_used;
  if v_used > v_limit and not public.is_admin() then
    raise exception 'ai quota exceeded' using errcode = 'P0001', hint = v_limit::text;
  end if;
  return greatest(v_limit - v_used, 0);
end;
$$;

-- Gives back one request after a failed model call (service role only).
create function public.ai_quota_refund(p_user uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set used = greatest(used - 1, 0)
   where user_id = p_user and day = public.vn_today() and kind = p_kind;
$$;

------------------------------------------------------------------ privileges
revoke execute on function
  public.ai_quota_limit(text),
  public.ai_quota_status(text),
  public.ai_quota_take(text),
  public.ai_quota_refund(uuid, text)
from public, anon, authenticated;

grant execute on function public.ai_quota_status(text), public.ai_quota_take(text) to authenticated;
grant execute on function public.ai_quota_refund(uuid, text) to service_role;
