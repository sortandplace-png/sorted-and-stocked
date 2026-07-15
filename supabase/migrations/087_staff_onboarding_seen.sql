-- 087_staff_onboarding_seen.sql
-- Tracks whether a Staff-role user has been shown the 4-screen onboarding
-- flow (once, on first sign-in). Nullable timestamp rather than a bare
-- boolean -- same information a checkbox would give (IS NOT NULL), plus a
-- free record of when, at no extra cost.
alter table public.profiles
  add column if not exists staff_onboarding_seen_at timestamptz;

comment on column public.profiles.staff_onboarding_seen_at is
  'When this user completed or skipped the Staff onboarding flow. Null = not shown yet.';
