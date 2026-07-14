-- Invite-code-gated self-service signup. Real gap confirmed: no path
-- exists for a brand-new client household to create their own account --
-- Forgot Password only works for an existing account, and invites require
-- someone to manually create the auth user first (generateLink). Racquel
-- confirmed gated (not fully open) is the right model, matching this
-- app's existing invite-only architecture.
--
-- RLS enabled with ZERO policies, deliberately -- this table is only ever
-- touched by the service-role admin client inside app/api/signup/route.ts,
-- never queried directly by an authenticated or anon client. That's what
-- actually makes the gate real: the code check happens server-side before
-- admin.auth.admin.createUser() runs, which works regardless of whether
-- Supabase's own public signUp() is enabled or not. Racquel still needs
-- to disable "Allow new users to sign up" in Supabase Auth settings for
-- the gate to be airtight against someone calling supabase.auth.signUp()
-- directly with the public anon key -- that's a dashboard-only toggle,
-- no tool access to flip it from here.
create table public.signup_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.signup_codes enable row level security;
