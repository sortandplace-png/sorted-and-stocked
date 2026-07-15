-- PostgREST can't filter one column against another (current_qty < min_qty)
-- through the normal query-builder API -- the same class of bug as the
-- inventory-count cap found earlier tonight: fetching all rows and
-- filtering client-side would silently truncate at the project's row cap
-- for any property over that size. A plain SQL function does the
-- comparison server-side instead. security invoker (the default) so the
-- caller's own inventory_items RLS still applies -- no need to reimplement
-- the property-membership check here.
create or replace function public.get_low_stock_items(p_property_id uuid)
returns table (id uuid, name text, current_qty numeric, min_qty numeric, category text)
language sql
stable
as $function$
  select id, name, current_qty, min_qty, category
  from public.inventory_items
  where property_id = p_property_id
    and current_qty < min_qty
  order by name;
$function$;
