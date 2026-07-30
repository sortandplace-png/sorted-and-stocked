-- 143_fix_low_stock_summary_phantom_row.sql
-- v_low_stock_summary LEFT JOINs inventory_items onto every property so a
-- property with zero items still gets a row (the point of the view -- a
-- fleet-wide comparison, not a per-item list). But its four aggregates all
-- used count(*), which counts THAT ROW ITSELF even when every ii.* column
-- in it is the join's own null-fill -- confirmed live: Low and Lax (0 real
-- inventory_items each) both read total_items=1, never_counted=1 before
-- this fix. Procurement's own per-property card renders total_items
-- directly ("{items_low} of {total_items} items low"), which is where
-- Racquel saw "0 of 1 items low" on two properties with no inventory at
-- all.
--
-- count(ii.id) instead of count(*) in all four: count() on a column never
-- counts a null, and every ii.* column -- including id -- is null on
-- exactly the phantom row a property-with-no-items produces. items_low and
-- items_counted already excluded the phantom row correctly on their own
-- (their FILTER conditions happen to be false for it), but switched them
-- too for one consistent, not-accidentally-correct pattern across all four.
create or replace view v_low_stock_summary as
select
  p.name as property,
  (p.city || ', '::text) || p.state as location,
  p.kosher_store_name as store,
  count(ii.id) filter (where ii.min_qty is not null and ii.current_qty <= ii.min_qty and ii.auto_restock_eligible and ii.last_counted_at is not null) as items_low,
  count(ii.id) filter (where ii.last_counted_at is null) as never_counted,
  count(ii.id) as total_items,
  count(ii.id) filter (where ii.last_counted_at is not null) as items_counted
from properties p
left join inventory_items ii on ii.property_id = p.id
group by p.name, p.city, p.state, p.kosher_store_name;
