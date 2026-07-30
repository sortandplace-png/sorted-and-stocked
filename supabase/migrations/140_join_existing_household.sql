-- 140_join_existing_household.sql
-- SS-370. create_property_with_household (migration 139) always minted a
-- brand-new household, one per property -- correct for the orphan bug it
-- fixed, but it means Strauss's real shape (Main + Country, one household,
-- two properties) can never be reproduced through the actual Add Property
-- form. Adds a nullable p_household_id: when supplied, the caller must
-- already be an owner or manager of an existing property in that household
-- (households itself has no member list of its own -- only properties do,
-- via property_members -- so authorization checks through those), and the
-- new property links to it instead of spawning a new one. Omitting the
-- argument keeps today's behavior exactly as-is.
--
-- DROP is required, not just CREATE OR REPLACE: a second parameter changes
-- the function's signature, so REPLACE alone would create a second
-- overload sitting next to the original (text)-only version rather than
-- retiring it -- ambiguous-call risk from supabase.rpc() the moment both
-- exist. Dropping first guarantees exactly one version on disk.
drop function if exists create_property_with_household(text);

create or replace function create_property_with_household(
  p_property_name text,
  p_household_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(p_property_name);
  v_household_id uuid;
  v_property_id uuid;
  v_is_authorized boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Property name is required';
  end if;

  if p_household_id is not null then
    select exists (
      select 1
      from property_members pm
      join properties p on p.id = pm.property_id
      where p.household_id = p_household_id
        and pm.user_id = v_user_id
        and pm.role in ('owner', 'manager')
    ) into v_is_authorized;

    if not v_is_authorized then
      raise exception 'Not authorized to add a property to this household';
    end if;

    v_household_id := p_household_id;
  else
    insert into households (name, created_by)
    values (v_name, v_user_id)
    returning id into v_household_id;
  end if;

  -- 003_auto_owner_membership.sql's trigger enrolls v_user_id as owner in
  -- property_members automatically on this insert, same as before.
  insert into properties (name, household_id, created_by)
  values (v_name, v_household_id, v_user_id)
  returning id into v_property_id;

  return v_property_id;
end;
$$;

grant execute on function create_property_with_household(text, uuid) to authenticated;
