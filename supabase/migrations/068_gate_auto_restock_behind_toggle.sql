-- 3g Part A: the low-stock auto-add-to-shopping-list trigger (handle_low_stock,
-- trg_inventory_low_stock) already exists and already runs unconditionally --
-- this isn't new functionality, it's adding a kill-switch to something
-- already live. Safe to default off right now specifically because every
-- real inventory_items row currently has min_qty = 0 (confirmed live: 0 of
-- 737 rows would fire either way), so this changes zero current behavior --
-- it only matters once real par levels get set going forward.
--
-- Reuses properties.feature_flags (jsonb, same pattern as guest_taste_memory
-- in app/properties/[id]/tools/page.tsx) rather than a new dedicated column.
create or replace function public.handle_low_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_list_id uuid;
  v_enabled boolean;
begin
  select coalesce((p.feature_flags->>'auto_restock')::boolean, false)
  into v_enabled
  from public.properties p
  where p.id = new.property_id;

  if not v_enabled then
    return new;
  end if;

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
