-- ============================================================================
-- 007: Rate limiting
-- ============================================================================
-- Why this lives in Postgres instead of an in-memory counter: Vercel (and
-- most serverless hosts) run each request on a fresh/arbitrary instance —
-- an in-memory counter would reset or miss requests unpredictably. Storing
-- events in Supabase means every instance sees the same count.

create table public.rate_limit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  created_at  timestamptz not null default now()
);

create index idx_rate_limit_events_lookup on public.rate_limit_events(user_id, action, created_at);

alter table public.rate_limit_events enable row level security;

-- Hygiene only — the app never queries this table directly, the function
-- below (SECURITY DEFINER) does all the work. This just ensures that if
-- anything ever did query it from the client, a user could only see their
-- own rate-limit history, not everyone else's.
create policy "rate_limit_events_select_own"
  on public.rate_limit_events for select
  using (user_id = auth.uid());

-- Atomically checks whether the calling user is under the limit for a given
-- action, and if so, records this attempt and returns true. If over limit,
-- returns false and records nothing (so a blocked request doesn't itself
-- count against the window).
--
-- p_action: a short string identifying what's being limited, e.g. 'invite_email'
-- p_max_count: how many are allowed within the window
-- p_window_seconds: the rolling window size, e.g. 3600 for "per hour"
create or replace function public.check_and_record_rate_limit(
  p_action text,
  p_max_count int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Opportunistic cleanup: delete this user+action's events older than the
  -- window while we're already here, so the table doesn't grow forever
  -- without needing a separate scheduled job.
  delete from public.rate_limit_events
  where user_id = auth.uid()
    and action = p_action
    and created_at <= now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count
  from public.rate_limit_events
  where user_id = auth.uid()
    and action = p_action;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_events (user_id, action) values (auth.uid(), p_action);
  return true;
end;
$$;

revoke all on function public.check_and_record_rate_limit(text, int, int) from public, anon;
grant execute on function public.check_and_record_rate_limit(text, int, int) to authenticated;
