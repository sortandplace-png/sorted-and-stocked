-- 139_create_property_with_household.sql
-- Real fix for the Add Property orphan bug: NewPropertyForm.tsx inserted
-- directly into properties with no household_id at all, because nothing
-- ever gave it one to set. "Low" and "QA Demo" are the two live orphans
-- this produced (see 138_reconcile_low_household.sql for "Low").
--
-- households has NO INSERT policy (confirmed: only households_select_member
-- exists, and it requires a property already linked to the household to
-- even see it -- a chicken-and-egg problem for a household that doesn't
-- exist yet). A plain client-side insert into households was never
-- possible for a normal authenticated user, security-definer RPC or not --
-- this is the only way the create flow could ever have set household_id.
--
-- Always creates a NEW household alongside the property, atomically, named
-- after the property (matches the existing display convention -- a
-- single-property household with a matching name collapses to the bare
-- name via formatPropertyLabel, same as "Lax" already does). Does not
-- offer "join an existing household" -- not asked for, and every current
-- multi-property household (Strauss) was set up directly, not through this
-- form; that remains a separate, not-yet-built feature if it's ever wanted.
--
-- auth.uid() read from the JWT inside the function, never taken as a
-- parameter -- a caller cannot create a property/household "on behalf of"
-- someone else. p_property_name is bound as a value, never interpolated
-- into SQL text, so this is not injectable via the property name field.
create or replace function create_property_with_household(p_property_name text)
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Property name is required';
  end if;

  insert into households (name, created_by)
  values (v_name, v_user_id)
  returning id into v_household_id;

  -- 003_auto_owner_membership.sql's trigger enrolls v_user_id as owner in
  -- property_members automatically on this insert, same as before -- not
  -- duplicated here.
  insert into properties (name, household_id, created_by)
  values (v_name, v_household_id, v_user_id)
  returning id into v_property_id;

  return v_property_id;
end;
$$;

grant execute on function create_property_with_household(text) to authenticated;
