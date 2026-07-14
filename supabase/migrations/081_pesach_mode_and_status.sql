-- Pesach Mode: property-level feature_flags.pesach_mode (jsonb, no schema
-- change needed there -- same pattern as auto_restock) + a real per-item
-- halachic classification field, inventory_items.pesach_status.
--
-- Every existing row defaults to needs_review -- deliberately NOT inferred
-- from name/category/ingredients for any item. This is a halachic
-- classification, same caution already applied to bracha_category and
-- is_shabbos_only: a human has to actually decide it, not a heuristic.

alter table public.inventory_items
  add column pesach_status text not null default 'needs_review'
  check (pesach_status in ('kosher_for_pesach', 'not_kosher_for_pesach', 'needs_review'));

-- Extend the shopping-list RPC to carry pesach_status through so the
-- Pesach Mode inline flag (recipe is_pesach + linked item not cleared) can
-- be computed client-side without a second round-trip. Return shape is
-- changing (new trailing column), so Postgres requires a drop first.
drop function if exists public.get_shopping_list_with_inventory(uuid);

create function public.get_shopping_list_with_inventory(p_shopping_list_id uuid)
returns table(item_id uuid, name text, name_es text, category text, qty_needed numeric, status text, inventory_item_id uuid, photo_url text, reorder_link text, current_stock numeric, location_name text, supplier text, kosher_type text, is_rich_item boolean, is_staple_origin boolean, pesach_status text)
language sql
stable security definer
set search_path = public
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
    (s.id is not null) as is_staple_origin,
    ii.pesach_status
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
