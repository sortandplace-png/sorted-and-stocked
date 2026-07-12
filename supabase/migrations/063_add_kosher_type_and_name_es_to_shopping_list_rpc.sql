-- Shopping card redesign needs kosher_type (Meat/Dairy/Parve pill) and a
-- bilingual name for rich items -- both already exist on inventory_items,
-- just weren't selected here. Plain-text (unmapped) items keep name_es/
-- kosher_type null, same graceful-degradation as photo_url/reorder_link.
drop function if exists public.get_shopping_list_with_inventory(uuid);

create function public.get_shopping_list_with_inventory(p_shopping_list_id uuid)
returns table(
  item_id uuid,
  name text,
  name_es text,
  category text,
  qty_needed numeric,
  status text,
  inventory_item_id uuid,
  photo_url text,
  reorder_link text,
  current_stock numeric,
  location_name text,
  supplier text,
  kosher_type text,
  is_rich_item boolean,
  is_staple_origin boolean
)
language sql
stable security definer
as $function$
  select
    sli.id as item_id,
    sli.name,
    ii.name_es,
    sli.category,
    sli.qty_needed,
    sli.status::text,
    ii.id as inventory_item_id,
    ii.photo_url,
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
  where sli.shopping_list_id = p_shopping_list_id
  order by
    case when s.id is not null then 0 else 1 end asc,
    sli.category asc,
    sli.name asc;
$function$;
