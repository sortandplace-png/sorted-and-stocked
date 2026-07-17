-- get_low_stock_items returned one row per (item, location) since
-- inventory_items is tracked per-location -- an item low in 3 locations
-- produced 3 identical-looking rows on the Low Stock Alerts widget
-- ("Adhesive Medical Tape / Gauze" x3, "Advil" x2/x3). DISTINCT ON (name),
-- ordered by the worst-case depletion ratio first, collapses this to one
-- row per name while surfacing the real qty/min from whichever location is
-- most depleted -- not an average, not the first row Postgres happens to
-- return.
create or replace function public.get_low_stock_items(p_property_id uuid)
returns table (id uuid, name text, current_qty numeric, min_qty numeric, category text)
language sql
stable
as $function$
  select distinct on (name) id, name, current_qty, min_qty, category
  from public.inventory_items
  where property_id = p_property_id
    and current_qty < min_qty
  order by name, (current_qty / nullif(min_qty, 0)) asc, current_qty asc;
$function$;
