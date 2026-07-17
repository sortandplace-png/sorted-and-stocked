-- Real bug in the existing create_inventory_item_with_source (created
-- live, no prior migration -- syncing the fix here since there's nothing
-- to diff against): `INSERT INTO inventory_items SELECT * FROM
-- jsonb_populate_record(null::inventory_items, item_data - 'id')` looks
-- like it should fall back to each column's own DEFAULT for anything
-- item_data doesn't include, but it doesn't -- jsonb_populate_record
-- against a null base leaves every absent key as an explicit NULL, and
-- `INSERT ... SELECT *` supplies an explicit value (even a null one) for
-- every column, which is exactly the case where Postgres does NOT apply
-- column defaults. Confirmed directly: calling jsonb_populate_record with
-- a minimal payload (no id, no pesach_status, no updated_at, no
-- bracha_needs_sourcing) returns NULL for all of them, and the INSERT
-- fails on the id NOT NULL constraint before it would even reach the
-- others -- this would have failed on every real call, not just ones
-- missing optional fields.
--
-- Fixed by listing columns explicitly: id and updated_at are left off
-- the INSERT entirely (letting their real gen_random_uuid()/now()
-- defaults apply the normal way, the same as any other insert), and the
-- other NOT NULL-with-default columns (current_qty, min_qty, unit,
-- print_label, bracha_needs_sourcing, pesach_status) fall back via
-- COALESCE if item_data didn't include them. qr_code is left off too --
-- a BEFORE INSERT trigger already generates it regardless of what value
-- would otherwise be inserted (confirmed empirically), so touching it
-- here would be redundant at best.
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
    photo_url, supplier, unit_cost, reorder_link, notes, category_group,
    category_id, name_es, kosher_type, hechsher, expiration_date,
    bracha_category, print_label, bracha_achrona, bracha_achrona_note,
    bracha_needs_sourcing, opened_date, photo_sourcing_type, pesach_status,
    last_counted_at
  )
  values (
    populated.property_id, populated.location_id, populated.name, populated.category,
    coalesce(populated.current_qty, 0), coalesce(populated.min_qty, 0),
    coalesce(populated.unit, 'pcs'), populated.photo_url, populated.supplier,
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
