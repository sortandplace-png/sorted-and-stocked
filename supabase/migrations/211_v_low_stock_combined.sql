-- 211_v_low_stock_combined.sql
-- SS-013. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- get_low_stock_all_properties() had ALWAYS selected from this view, and
-- the view had never existed -- so the function was broken at runtime, not
-- merely unused. That is why SS-013 read as "never built" when the data
-- layer was most of the way there.
--
-- Grouped by item NAME, not by id: the point of a cross-property view is
-- that "Olive Oil" low in three houses is one line on one shopping trip.

create or replace view public.v_low_stock_combined as
select
  i.name,
  max(i.name_es)                                as name_es,
  max(i.category)                               as category,
  max(i.kosher_type)                            as kosher_type,
  max(i.photo_url)                              as photo_url,
  max(i.reorder_link)                           as reorder_link,
  count(distinct i.property_id)                 as houses_needing,
  string_agg(distinct p.name, ', ' order by p.name) as which_houses,
  sum(greatest(coalesce(i.min_qty,0) - coalesce(i.current_qty,0), 0)) as total_short
from public.inventory_items i
join public.properties p on p.id = i.property_id
where p.archived_at is null
  -- The single definition of low (migration 158), never re-implemented here.
  and public.is_inventory_item_low(i.*)
group by i.name;

comment on view public.v_low_stock_combined is
  'SS-013. Cross property low stock, grouped by item name. get_low_stock_all_properties selects from this view and was BROKEN at runtime because the view did not exist. Archived properties excluded so QA Demo never appears in a real shopping view.';
