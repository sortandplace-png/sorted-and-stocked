-- Surface inventory_items.hechsher through get_staples_with_inventory so the
-- Household Staples tab can show real hechsher data instead of staying
-- silent about it. RETURNS TABLE shape change requires drop + recreate.
drop function if exists public.get_staples_with_inventory(uuid, uuid);

create function public.get_staples_with_inventory(p_property_id uuid, p_shopping_list_id uuid)
returns table(
  staple_id uuid,
  staple_name text,
  staple_category text,
  default_unit text,
  inventory_item_id uuid,
  current_qty numeric,
  min_qty numeric,
  location_id uuid,
  photo_url text,
  is_low boolean,
  already_on_list boolean,
  last_counted_at timestamp with time zone,
  hechsher text
)
language sql
stable
security definer
as $$
  select
    s.id as staple_id,
    s.name as staple_name,
    s.category as staple_category,
    s.default_unit,
    ii.id as inventory_item_id,
    ii.current_qty,
    ii.min_qty,
    ii.location_id,
    ii.photo_url,
    (ii.last_counted_at is not null and ii.current_qty < ii.min_qty) as is_low,
    exists (
      select 1 from shopping_list_items sli
      where sli.shopping_list_id = p_shopping_list_id
        and sli.inventory_item_id = ii.id
    ) as already_on_list,
    ii.last_counted_at,
    ii.hechsher
  from public.staples s
  join public.inventory_items ii on s.inventory_item_id = ii.id
  where ii.property_id = p_property_id
  order by s.category asc, s.name asc;
$$;
