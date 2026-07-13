-- get_shopping_list_with_inventory only ever pulled photo_url from the
-- linked inventory_items row -- null for any item that isn't inventory-
-- linked, which right now is 100% of Strauss's pending list (0 of 132 items
-- have an inventory_item_id). recipe_ingredients has its own well-populated
-- photo_url (1,969 of 2,320 rows), completely unused by this function.
-- shopping_list_items has no direct FK back to a specific recipe_ingredients
-- row (shopping_list_item_sources only carries recipe_id, not an ingredient
-- row id), so the fallback join matches on name -- the same name shopping
-- list generation copied from recipe_ingredients.name in the first place.
-- is_rich_item's meaning is untouched (still gates supplier/stock/location/
-- reorder-link, which genuinely do require a real inventory link) -- only
-- photo_url gets the fallback.
--
-- category gets the same name-matched fallback for the same reason:
-- shopping_list_items.category is a snapshot copied from
-- recipe_ingredients.category at generation time (lib/shopping-list-
-- actions.ts), not a live reference -- most of Strauss's 132 pending items
-- predate tonight's aisle-fill pass, so they're still carrying the old
-- null/stray ("Dry"/"Wet") values even though the source recipe_ingredients
-- row has long since been categorized correctly. Confirmed live: 74 of 132
-- pending items were grouping into "Other" before this.
--
-- Second pass, after a direct fix elsewhere brought inventory_item_id
-- linkage from 0/132 to 130/132: added ii.category (the now-real linked
-- inventory item's own category) ahead of the name-matched fallback, since
-- a real link beats a fuzzy name match. inventory_items uses a broader
-- 16-value household taxonomy (Personal Care, Cleaners, Beverages, etc.),
-- not recipe_ingredients' 6-value aisle set -- only mapped the values that
-- genuinely correspond (confirmed live against this property's real
-- category list); anything else (e.g. "Beverages", no clean equivalent)
-- still falls through to 'Other' rather than forcing a bad-fit mapping.
create or replace function public.get_shopping_list_with_inventory(p_shopping_list_id uuid)
returns table(item_id uuid, name text, name_es text, category text, qty_needed numeric, status text, inventory_item_id uuid, photo_url text, reorder_link text, current_stock numeric, location_name text, supplier text, kosher_type text, is_rich_item boolean, is_staple_origin boolean)
language sql
stable security definer
as $$
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
    sli.status::text,
    ii.id as inventory_item_id,
    coalesce(ii.photo_url, ri.photo_url) as photo_url,
    ii.reorder_link,
    ii.current_qty as current_stock,
    l.name as location_name,
    ii.supplier,
    ii.kosher_type,
    (ii.id is not null) as is_rich_item,
    (s.id is not null) as is_staple_origin
  from public.shopping_list_items sli
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
  where sli.shopping_list_id = p_shopping_list_id
  order by
    case when s.id is not null then 0 else 1 end asc,
    category asc,
    sli.name asc;
$$;
