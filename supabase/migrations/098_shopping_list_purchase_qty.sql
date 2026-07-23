-- qty_needed is the recipe-derived amount (and per ShoppingListViewEnhanced's
-- own comment, is actually a hardcoded default of 1 on every real row -- the
-- real per-recipe amounts live in shopping_list_item_sources). Neither
-- represents "how many units to buy" (e.g. recipe needs 2 cups flour, but
-- you buy 1 five-pound bag) -- there was no column for that decision at all.
-- purchase_qty is nullable with no default: unset means "not yet decided",
-- distinct from a real 0 or 1.
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS purchase_qty numeric;

-- get_shopping_list_with_inventory's return row type is changing, which
-- CREATE OR REPLACE can't do -- same DROP-first requirement hit when
-- reorder_sources was added to this same function (093).
DROP FUNCTION IF EXISTS public.get_shopping_list_with_inventory(uuid);

CREATE FUNCTION public.get_shopping_list_with_inventory(p_shopping_list_id uuid)
RETURNS TABLE(
  item_id uuid, name text, name_es text, category text, qty_needed numeric,
  purchase_qty numeric, status text, inventory_item_id uuid, photo_url text,
  reorder_link text, reorder_sources jsonb, current_stock numeric,
  location_name text, supplier text, kosher_type text, is_rich_item boolean,
  is_staple_origin boolean, pesach_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select
    sli.id as item_id,
    sli.name,
    ii.name_es,
    coalesce(
      case
        when sli.category in ('Produce', 'Spices / Condiments', 'Pantry', 'Bakery / Dry', 'Meat / Fish', 'Dairy / Eggs')
        then sli.category
        else null
      end,
      case ii.category
        when 'Produce' then 'Produce'
        when 'Pantry' then 'Pantry'
        when 'Bakery' then 'Bakery / Dry'
        when 'Meat & Seafood' then 'Meat / Fish'
        when 'Dairy' then 'Dairy / Eggs'
        else null
      end,
      ri.category,
      'Other'
    ) as category,
    sli.qty_needed,
    sli.purchase_qty,
    sli.status::text,
    ii.id as inventory_item_id,
    coalesce(ii.photo_url, ri.photo_url) as photo_url,
    ii.reorder_link,
    rs.sources as reorder_sources,
    ii.current_qty as current_stock,
    l.name as location_name,
    ii.supplier,
    ii.kosher_type,
    (ii.id is not null) as is_rich_item,
    (s.id is not null) as is_staple_origin,
    ii.pesach_status
  from public.shopping_list_items sli
  join public.shopping_lists sl on sl.id = sli.shopping_list_id
  left join public.inventory_items ii on sli.inventory_item_id = ii.id
  left join public.locations l on ii.location_id = l.id
  left join public.staples s on s.inventory_item_id = ii.id
  left join lateral (
    select ri2.photo_url, ri2.category
    from public.recipe_ingredients ri2
    where lower(trim(ri2.name)) = lower(trim(sli.name))
      and (ri2.photo_url is not null or ri2.category is not null)
    order by ri2.photo_url is not null desc, ri2.category is not null desc
    limit 1
  ) ri on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', rsrc.id, 'retailer_name', rsrc.retailer_name, 'url', rsrc.url, 'is_preferred', rsrc.is_preferred)
      order by rsrc.is_preferred desc, rsrc.created_at asc
    ) as sources
    from public.reorder_sources rsrc
    where rsrc.inventory_item_id = ii.id
  ) rs on true
  where sli.shopping_list_id = p_shopping_list_id
    and is_property_member(sl.property_id)
  order by
    case when s.id is not null then 0 else 1 end asc,
    category asc,
    sli.name asc;
$function$;
