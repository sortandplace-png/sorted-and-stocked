-- 158_single_definition_low_stock.sql
-- SS-247, unblocked by the 31 Jul keep ruling. "Low stock" was defined in
-- SIX places: inline in get_low_stock_items(), inline in each of the three
-- v_low_stock_* views, re-derived in InventoryClient.isLowStock(), and a
-- third, WRONG derivation (strict <, no gates) in the unmounted
-- AnalyticsDashboard. Two definitions caused the original SS-247 bug;
-- six is the same bug waiting to happen four more times.
--
-- One predicate now owns the definition:
--   min_qty set  AND  current_qty <= min_qty
--   AND auto_restock_eligible  AND  physically counted at least once
-- Everything else -- both RPCs, all three views -- calls it. The client
-- stops deriving anything: it consumes get_low_stock_item_ids() and does
-- set membership (the existing get_low_stock_items() keeps its
-- distinct-on-name dedupe for the shopping tile, which is why it cannot
-- serve as a per-item flag source -- a duplicate-named low item would
-- vanish from the badge).
--
-- View options preserved exactly as found: _all_properties and
-- _by_property are security_invoker; _summary deliberately is not (it is
-- the operator's cross-property aggregate).

create or replace function public.is_inventory_item_low(ii inventory_items)
returns boolean
language sql
immutable
as $$
  select ii.min_qty is not null
     and ii.current_qty <= ii.min_qty
     and ii.auto_restock_eligible
     and ii.last_counted_at is not null
$$;

create or replace function public.get_low_stock_items(p_property_id uuid)
returns table(id uuid, name text, current_qty numeric, min_qty numeric, category text, photo_url text)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select distinct on (i.name) i.id, i.name, i.current_qty, i.min_qty, i.category, i.photo_url
  from public.inventory_items i
  where i.property_id = p_property_id
    and public.is_inventory_item_low(i)
  order by i.name, (i.current_qty / nullif(i.min_qty, 0)) asc, i.current_qty asc;
$$;

create or replace function public.get_low_stock_item_ids(p_property_id uuid)
returns setof uuid
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select i.id
  from public.inventory_items i
  where i.property_id = p_property_id
    and public.is_inventory_item_low(i);
$$;

revoke execute on function public.get_low_stock_item_ids(uuid) from public;
revoke execute on function public.get_low_stock_item_ids(uuid) from anon;
grant execute on function public.get_low_stock_item_ids(uuid) to authenticated;
grant execute on function public.get_low_stock_item_ids(uuid) to service_role;

create or replace view public.v_low_stock_all_properties
with (security_invoker = true) as
 select p.id as property_id,
    p.name as property,
    ii.id as item_id,
    ii.name,
    ii.name_es,
    ii.category,
    ii.kosher_type,
    l.name as location,
    ii.current_qty,
    ii.min_qty,
    (ii.min_qty - ii.current_qty) as short_by,
    ii.photo_url,
    ii.reorder_link,
    ii.supplier,
    (ii.last_counted_at is null) as never_counted
   from inventory_items ii
     join properties p on p.id = ii.property_id
     left join locations l on l.id = ii.location_id
  where public.is_inventory_item_low(ii);

create or replace view public.v_low_stock_by_property
with (security_invoker = true) as
 select p.id as property_id,
    p.name as property,
    ((p.city || ', '::text) || p.state) as location,
    p.kosher_store_name as store,
    ii.id as item_id,
    ii.name,
    ii.name_es,
    ii.category,
    ii.kosher_type,
    l.name as room,
    ii.current_qty,
    ii.min_qty,
    greatest((ii.min_qty - ii.current_qty), (0)::numeric) as short_by,
    ii.photo_url,
    ii.reorder_link,
    (ii.last_counted_at is null) as never_counted
   from inventory_items ii
     join properties p on p.id = ii.property_id
     left join locations l on l.id = ii.location_id
  where public.is_inventory_item_low(ii);

create or replace view public.v_low_stock_summary as
 select p.name as property,
    ((p.city || ', '::text) || p.state) as location,
    p.kosher_store_name as store,
    count(ii.id) filter (where public.is_inventory_item_low(ii)) as items_low,
    count(ii.id) filter (where ii.last_counted_at is null) as never_counted,
    count(ii.id) as total_items,
    count(ii.id) filter (where ii.last_counted_at is not null) as items_counted
   from properties p
     left join inventory_items ii on ii.property_id = p.id
  group by p.name, p.city, p.state, p.kosher_store_name;
