-- 112_add_case_size_to_create_item_rpc.sql
-- create_inventory_item_with_source (095) lists its INSERT columns
-- explicitly, so the new case_size column (111) wouldn't flow through on
-- item creation without this -- jsonb_populate_record already maps it
-- into `populated` automatically since it's a real column now, it just
-- needed adding to the INSERT itself. No COALESCE needed (unlike
-- min_qty/current_qty): null is a real, meaningful value here, not a
-- missing-input case to default away.
create or replace function public.create_inventory_item_with_source(
  item_data jsonb,
  source_retailer_name text default null,
  source_url text default null
)
returns inventory_items
language plpgsql
as $function$
declare
  new_item inventory_items;
  populated inventory_items;
begin
  if not is_property_member((item_data->>'property_id')::uuid) then
    raise exception 'not a member of this property';
  end if;

  populated := jsonb_populate_record(null::inventory_items, item_data - 'id');

  insert into inventory_items (
    property_id, location_id, name, category, current_qty, min_qty, unit,
    case_size, photo_url, supplier, unit_cost, reorder_link, notes, category_group,
    category_id, name_es, kosher_type, hechsher, expiration_date,
    bracha_category, print_label, bracha_achrona, bracha_achrona_note,
    bracha_needs_sourcing, opened_date, photo_sourcing_type, pesach_status,
    last_counted_at
  )
  values (
    populated.property_id, populated.location_id, populated.name, populated.category,
    coalesce(populated.current_qty, 0), coalesce(populated.min_qty, 0),
    coalesce(populated.unit, 'pcs'), populated.case_size, populated.photo_url, populated.supplier,
    populated.unit_cost, populated.reorder_link, populated.notes, populated.category_group,
    populated.category_id, populated.name_es, populated.kosher_type, populated.hechsher,
    populated.expiration_date, populated.bracha_category, coalesce(populated.print_label, true),
    populated.bracha_achrona, populated.bracha_achrona_note,
    coalesce(populated.bracha_needs_sourcing, false), populated.opened_date,
    populated.photo_sourcing_type, coalesce(populated.pesach_status, 'needs_review'),
    populated.last_counted_at
  )
  returning * into new_item;

  if source_url is not null and source_url != '' then
    insert into reorder_sources (property_id, inventory_item_id, retailer_name, url, is_preferred)
    values (new_item.property_id, new_item.id, coalesce(nullif(source_retailer_name, ''), 'Other'), source_url, true);
  end if;

  return new_item;
end;
$function$;
