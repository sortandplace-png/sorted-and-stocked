-- Two fixes from the architect audit (2026-07-14), independently verified
-- before fixing, not taken on faith:

-- 1. nine_days_windows has RLS enabled with zero policies -- confirmed live
-- (2 real rows, both silently unreadable to any RLS-scoped caller).
-- check_nine_days_meat() (the DB-level Nine Days meat-restriction trigger
-- on meal_plan_entries) queries this table as SECURITY INVOKER, so its
-- restriction has been silently inert this whole time -- the app-level
-- Hebcal-based check (lib/nine-days.ts) still works and is the real UI
-- gate, but this DB-level backstop never actually fired. Universal
-- reference data, not property-scoped -- authenticated read is enough.
create policy nine_days_windows_select_authenticated on nine_days_windows
  for select to authenticated using (true);

-- 2. get_user_id_by_email(p_email) had no property scoping at all -- any
-- authenticated user (including a staff account on any property) could
-- resolve any email to a real user_id. Only real caller is
-- components/StaffClient.tsx's invite flow, which always has a real
-- propertyId in scope -- added that as a required parameter and gated on
-- the same has_property_role(owner/manager) check every other
-- staff-management action already uses.
drop function if exists public.get_user_id_by_email(text);

create function public.get_user_id_by_email(p_email text, p_property_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when has_property_role(p_property_id, array['owner'::member_role, 'manager'::member_role])
    then (select id from auth.users where lower(email) = lower(p_email) limit 1)
    else null
  end;
$$;

revoke all on function public.get_user_id_by_email(text, uuid) from public, anon;
grant execute on function public.get_user_id_by_email(text, uuid) to authenticated;
