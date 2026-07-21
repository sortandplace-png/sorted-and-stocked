-- 119_inventory_auto_restock_eligible.sql
-- Per-item flag distinguishing genuinely restockable items (food, paper
-- goods, disposable supplies) from durable equipment/appliances that
-- shouldn't be auto-suggested by low-stock alerts or the auto-restock
-- trigger even if someone sets a min_qty on them (SS-213). Named
-- auto_restock_eligible, not auto_restock, to avoid colliding with the
-- existing properties.feature_flags->>'auto_restock' property-wide toggle
-- (handle_low_stock() below already checks that one; this is a separate,
-- per-item concept underneath it).
--
-- Default true: every one of the 1606 existing rows keeps behaving exactly
-- as before. Nothing is set false here -- no real inventory_items row for
-- an appliance exists today (confirmed live), so there's nothing to
-- retroactively flag. This is forward-looking infrastructure only.
alter table inventory_items
  add column auto_restock_eligible boolean not null default true;

create or replace view v_low_stock_by_property as
 SELECT p.id AS property_id,
    p.name AS property,
    ((p.city || ', '::text) || p.state) AS location,
    p.kosher_store_name AS store,
    ii.id AS item_id,
    ii.name,
    ii.name_es,
    ii.category,
    ii.kosher_type,
    l.name AS room,
    ii.current_qty,
    ii.min_qty,
    GREATEST((ii.min_qty - ii.current_qty), (0)::numeric) AS short_by,
    ii.photo_url,
    ii.reorder_link,
    (ii.current_qty = (0)::numeric) AS never_counted
   FROM ((inventory_items ii
     JOIN properties p ON ((p.id = ii.property_id)))
     LEFT JOIN locations l ON ((l.id = ii.location_id)))
  WHERE ((ii.min_qty IS NOT NULL) AND (ii.current_qty <= ii.min_qty) AND ii.auto_restock_eligible);

create or replace view v_low_stock_all_properties as
 SELECT p.id AS property_id,
    p.name AS property,
    ii.id AS item_id,
    ii.name,
    ii.name_es,
    ii.category,
    ii.kosher_type,
    l.name AS location,
    ii.current_qty,
    ii.min_qty,
    (ii.min_qty - ii.current_qty) AS short_by,
    ii.photo_url,
    ii.reorder_link,
    ii.supplier,
    (ii.current_qty = (0)::numeric) AS never_counted
   FROM ((inventory_items ii
     JOIN properties p ON ((p.id = ii.property_id)))
     LEFT JOIN locations l ON ((l.id = ii.location_id)))
  WHERE ((ii.min_qty IS NOT NULL) AND (ii.current_qty <= ii.min_qty) AND ii.auto_restock_eligible);

create or replace view v_low_stock_summary as
 SELECT p.name AS property,
    ((p.city || ', '::text) || p.state) AS location,
    p.kosher_store_name AS store,
    count(*) FILTER (WHERE ((ii.min_qty IS NOT NULL) AND (ii.current_qty <= ii.min_qty) AND ii.auto_restock_eligible)) AS items_low,
    count(*) FILTER (WHERE (ii.current_qty = (0)::numeric)) AS never_counted,
    count(*) AS total_items
   FROM (properties p
     LEFT JOIN inventory_items ii ON ((ii.property_id = p.id)))
  GROUP BY p.name, p.city, p.state, p.kosher_store_name;

create or replace function public.get_low_stock_items(p_property_id uuid)
 RETURNS TABLE(id uuid, name text, current_qty numeric, min_qty numeric, category text, photo_url text)
 LANGUAGE sql
 STABLE
AS $function$
  select distinct on (name) id, name, current_qty, min_qty, category, photo_url
  from public.inventory_items
  where property_id = p_property_id
    and current_qty < min_qty
    and auto_restock_eligible
  order by name, (current_qty / nullif(min_qty, 0)) asc, current_qty asc;
$function$;

create or replace function public.handle_low_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_list_id uuid;
  v_enabled boolean;
begin
  select coalesce((p.feature_flags->>'auto_restock')::boolean, false)
  into v_enabled
  from public.properties p
  where p.id = new.property_id;

  if not v_enabled or not new.auto_restock_eligible then
    return new;
  end if;

  if new.last_counted_at is not null
     and new.current_qty < new.min_qty
     and (tg_op = 'INSERT' or old.last_counted_at is null or old.current_qty >= old.min_qty) then

    select id into v_list_id
    from public.shopping_lists
    where property_id = new.property_id
      and status = 'active'
    order by created_at desc
    limit 1;

    if v_list_id is null then
      insert into public.shopping_lists (property_id, name, status)
      values (new.property_id, 'Shopping List', 'active')
      on conflict (property_id) where status = 'active' do nothing
      returning id into v_list_id;

      if v_list_id is null then
        select id into v_list_id
        from public.shopping_lists
        where property_id = new.property_id
          and status = 'active'
        order by created_at desc
        limit 1;
      end if;
    end if;

    if not exists (
      select 1 from public.shopping_list_items
      where shopping_list_id = v_list_id
        and inventory_item_id = new.id
        and status = 'pending'
    ) then
      insert into public.shopping_list_items
        (shopping_list_id, inventory_item_id, name, category, qty_needed, status)
      values
        (v_list_id, new.id, new.name, new.category,
         greatest(new.min_qty - new.current_qty, 1), 'pending');
    end if;
  end if;

  return new;
end;
$function$;
