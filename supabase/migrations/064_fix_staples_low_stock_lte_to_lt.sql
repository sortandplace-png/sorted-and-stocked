-- Same fix already applied to the main Inventory page's Below Par filter:
-- current_qty <= min_qty flags "at par" (e.g. 0/0, currently every real
-- item) as falsely low. All 143 staples were showing "Low Stock" for this
-- reason before this fix -- real count with the correct < is 0, which is
-- honest given every item is still at 0/0, not a new bug.
create or replace function public.get_staples_with_inventory(p_property_id uuid, p_shopping_list_id uuid)
returns table(staple_id uuid, staple_name text, staple_category text, default_unit text, inventory_item_id uuid, current_qty numeric, min_qty numeric, location_id uuid, is_low boolean, already_on_list boolean)
language sql
stable security definer
as $function$
  select
    s.id as staple_id,
    s.name as staple_name,
    s.category as staple_category,
    s.default_unit,
    ii.id as inventory_item_id,
    ii.current_qty,
    ii.min_qty,
    ii.location_id,
    (ii.current_qty < ii.min_qty) as is_low,
    exists (
      select 1 from shopping_list_items sli
      where sli.shopping_list_id = p_shopping_list_id
        and sli.inventory_item_id = ii.id
    ) as already_on_list
  from public.staples s
  join public.inventory_items ii on s.inventory_item_id = ii.id
  where ii.property_id = p_property_id
  order by s.category asc, s.name asc;
$function$;
