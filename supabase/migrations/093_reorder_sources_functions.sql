-- Multi-retailer reorder-source picker: the app-layer CRUD needs two
-- operations that can't be a plain PostgREST update/delete because they
-- touch more than one row atomically:
--   1. Setting a source preferred has to unset the old preferred row in
--      the same transaction, or the new reorder_sources_one_preferred_per_item
--      partial unique index (092) can transiently see two -- or, worse,
--      a crash between the two statements leaves zero.
--   2. Deleting the preferred source has to promote another one (oldest
--      remaining) in the same transaction, so an item is never left with
--      zero preferred sources.
-- Both are security invoker (the default) -- the caller's own RLS on
-- reorder_sources already gates who can update/delete, same as if they'd
-- issued the statements directly.

create or replace function public.set_preferred_reorder_source(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_item_id uuid;
begin
  select inventory_item_id into v_item_id from public.reorder_sources where id = p_id;
  if v_item_id is null then
    return;
  end if;

  update public.reorder_sources
  set is_preferred = false, updated_at = now()
  where inventory_item_id = v_item_id and id != p_id and is_preferred;

  update public.reorder_sources
  set is_preferred = true, updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.delete_reorder_source(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_item_id uuid;
  v_was_preferred boolean;
begin
  delete from public.reorder_sources
  where id = p_id
  returning inventory_item_id, is_preferred into v_item_id, v_was_preferred;

  if v_item_id is null then
    return;
  end if;

  if v_was_preferred then
    update public.reorder_sources
    set is_preferred = true, updated_at = now()
    where id = (
      select id from public.reorder_sources
      where inventory_item_id = v_item_id
      order by created_at asc
      limit 1
    );
  end if;
end;
$$;

-- inventory_items.reorder_link stays populated (not dropped, still read by
-- a few backfill/admin tools) but is no longer hand-edited -- it now just
-- mirrors whichever reorder_sources row is preferred for that item, kept
-- in sync automatically so nothing else that still reads the old column
-- goes stale.
create or replace function public.sync_inventory_reorder_link()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid;
begin
  v_item_id := coalesce(new.inventory_item_id, old.inventory_item_id);

  update public.inventory_items
  set reorder_link = (
    select url from public.reorder_sources
    where inventory_item_id = v_item_id and is_preferred
    limit 1
  )
  where id = v_item_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reorder_sources_sync_inventory_link on public.reorder_sources;
create trigger reorder_sources_sync_inventory_link
after insert or update or delete on public.reorder_sources
for each row execute function public.sync_inventory_reorder_link();

-- Shopping list card display reads via this RPC, not a direct table
-- select, so the new sources list has to be added to its return shape.
-- reorder_link is left in place (additive change, nothing removed) for
-- any other caller of this RPC that hasn't moved onto reorder_sources.
-- Postgres won't let CREATE OR REPLACE change a function's OUT-parameter
-- row type, so the old signature has to be dropped first.
drop function if exists public.get_shopping_list_with_inventory(uuid);

create function public.get_shopping_list_with_inventory(p_shopping_list_id uuid)
returns table(
  item_id uuid, name text, name_es text, category text, qty_needed numeric, status text,
  inventory_item_id uuid, photo_url text, reorder_link text, reorder_sources jsonb,
  current_stock numeric, location_name text, supplier text, kosher_type text,
  is_rich_item boolean, is_staple_origin boolean, pesach_status text
)
language sql
stable security definer
set search_path to 'public'
as $function$
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
