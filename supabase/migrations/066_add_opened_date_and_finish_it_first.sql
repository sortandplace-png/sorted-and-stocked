-- 3e-i "Open It First": lets a household track when a real item was opened,
-- and surfaces it through the existing duplicate-detection flow (same RPC
-- already used for "Already have this?") rather than building a second,
-- separate warning system.
alter table inventory_items add column if not exists opened_date date;

drop function if exists public.find_similar_inventory_items(uuid, text, real);

create function public.find_similar_inventory_items(
  p_property_id uuid,
  p_name text,
  p_threshold real default 0.45
)
returns table(
  id uuid,
  name text,
  location_name text,
  similarity real,
  opened_date date,
  current_qty numeric
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    i.id,
    i.name,
    l.name as location_name,
    greatest(similarity(i.name, p_name), coalesce(similarity(i.name_es, p_name), 0)) as similarity,
    i.opened_date,
    i.current_qty
  from public.inventory_items i
  left join public.locations l on l.id = i.location_id
  where i.property_id = p_property_id
    and is_property_member(p_property_id)
    and greatest(similarity(i.name, p_name), coalesce(similarity(i.name_es, p_name), 0)) >= p_threshold
  order by similarity desc
  limit 5;
$$;
