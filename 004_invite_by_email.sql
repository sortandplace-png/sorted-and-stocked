-- ============================================================================
-- 004: Email → user_id lookup for invites
-- ============================================================================
-- Client code can't query auth.users directly (not exposed via the anon
-- key), and pulling in the service-role key just to look up one id is
-- more attack surface than this needs. Instead: a narrow SECURITY DEFINER
-- function that returns only a UUID (or null) for a given email — no other
-- user data is exposed. Any authenticated user can call it; the actual
-- property_members insert that follows is still gated by the existing
-- owner/manager RLS policy, so this alone doesn't grant any access.

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public, anon;
grant execute on function public.get_user_id_by_email(text) to authenticated;
