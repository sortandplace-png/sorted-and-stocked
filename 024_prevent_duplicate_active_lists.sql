-- ============================================================================
-- 024: Prevent duplicate active shopping lists per property
-- ============================================================================
-- Root cause of "test house" ending up with 2 empty active lists 150ms
-- apart: both ShoppingListClient.tsx's loadData() and MealPlanClient.tsx's
-- addWeekToShoppingList() do a plain "check for active list, if none insert
-- one" with no locking. Two near-simultaneous calls (double-render in
-- StrictMode, two tabs, a slow-network retry) can both see "none exists"
-- and both insert.
--
-- This index makes that impossible at the database level; the app-side fix
-- (in both call sites above) catches the resulting unique-violation and
-- just fetches the list that won the race instead of surfacing an error.
--
-- The handle_low_stock() trigger (001_init_schema.sql) has the identical
-- check-then-insert shape, so it gets the same on-conflict treatment here
-- even though a same-transaction race there is far less likely.
-- ============================================================================

create unique index shopping_lists_one_active_per_property
  on public.shopping_lists (property_id)
  where status = 'active';

create or replace function public.handle_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
begin
  if new.current_qty < new.min_qty
     and (tg_op = 'INSERT' or old.current_qty >= old.min_qty) then

    select id into v_list_id
    from public.shopping_lists
    where property_id = new.property_id
      and status = 'active'
    order by created_at desc
    limit 1;

    if v_list_id is null then
      insert into public.shopping_lists (property_id, name, status)
      values (new.property_id, 'Shopping List', 'active')
      on conflict (property_id) where status = 'active' do nothing
      returning id into v_list_id;

      -- Someone else's concurrent insert won the race — fetch theirs.
      if v_list_id is null then
        select id into v_list_id
        from public.shopping_lists
        where property_id = new.property_id
          and status = 'active'
        order by created_at desc
        limit 1;
      end if;
    end if;

    if not exists (
      select 1 from public.shopping_list_items
      where shopping_list_id = v_list_id
        and inventory_item_id = new.id
        and status = 'pending'
    ) then
      insert into public.shopping_list_items
        (shopping_list_id, inventory_item_id, name, category, qty_needed, status)
      values
        (v_list_id, new.id, new.name, new.category,
         greatest(new.min_qty - new.current_qty, 1), 'pending');
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Bonus fix, discovered while deleting the "test house" property: the last-
-- owner guard (006_prevent_last_owner_removal.sql) fires on every DELETE
-- from property_members, including the cascade delete triggered by removing
-- the property itself — so it was blocking ALL property deletion, not just
-- last-owner removal while the property still exists. Skip the check once
-- the property row is already gone; that's not "orphaning an owned
-- property," that's "the property doesn't exist anymore."
-- ============================================================================

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

  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  -- The property itself is being (or already was) deleted in this same
  -- cascade — nothing left to protect.
  if not exists (select 1 from public.properties where id = v_property_id) then
    return coalesce(new, old);
  end if;

  select count(*) into v_owner_count
  from public.property_members
  where property_id = v_property_id and role = 'owner';

  if v_owner_count <= 1 then
    raise exception 'Cannot remove or demote the last owner of this property. Promote another member to owner first.';
  end if;

  return coalesce(new, old);
end;
$$;
