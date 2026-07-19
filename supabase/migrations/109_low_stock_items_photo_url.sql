-- Add photo_url to get_low_stock_items so the dashboard's Low Stock
-- Alerts widget can show the actual low-stock items' own photos
-- (Racquel's explicit direction: "the items that are low, same pic as
-- inventory" -- reuse each item's existing photo, not a generic stock
-- image). Pure additive column on the return table; the distinct-on/
-- order-by logic is otherwise unchanged from the original. Postgres
-- won't let CREATE OR REPLACE add a column to an existing RETURNS TABLE
-- signature (confirmed live), hence the explicit drop -- checked
-- pg_depend first, nothing else in the schema references this function.
drop function if exists public.get_low_stock_items(uuid);

create function public.get_low_stock_items(p_property_id uuid)
returns table(id uuid, name text, current_qty numeric, min_qty numeric, category text, photo_url text)
language sql
stable
as $$
  select distinct on (name) id, name, current_qty, min_qty, category, photo_url
  from public.inventory_items
  where property_id = p_property_id
    and current_qty < min_qty
  order by name, (current_qty / nullif(min_qty, 0)) asc, current_qty asc;
$$;
