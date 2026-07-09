-- ============================================================================
-- 006: Prevent removing/demoting the last owner
-- ============================================================================
-- Gap identified while building the staff management UI: nothing stopped
-- an owner from demoting themselves (or being demoted, or removed) if they
-- were the property's only owner, leaving it ownerless with no one able to
-- pass the owner/manager-only RLS checks on properties, property_members,
-- locations, inventory_items, shopping_lists, categories, etc. This is a
-- one-way door, so block it at the database level, not just in the UI.

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_owner_count int;
begin
  v_property_id := coalesce(old.property_id, new.property_id);

  -- Only relevant when the row being removed/changed was itself an owner.
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  -- On update, no-op if role isn't actually changing away from owner.
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  -- Lock this property's membership rows before counting owners, so two
  -- concurrent demotions/removals of different owners can't both read
  -- "2 owners, safe to proceed" and both succeed, leaving zero owners.
  perform 1 from public.property_members where property_id = v_property_id for update;

  select count(*) into v_owner_count
  from public.property_members
  where property_id = v_property_id and role = 'owner';

  if v_owner_count <= 1 then
    raise exception 'Cannot remove or demote the last owner of this property. Promote another member to owner first.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_prevent_last_owner_removal
  before update or delete on public.property_members
  for each row execute procedure public.prevent_last_owner_removal();
