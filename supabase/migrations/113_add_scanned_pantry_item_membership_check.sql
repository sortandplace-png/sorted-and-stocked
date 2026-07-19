-- supabase/migrations/113_add_scanned_pantry_item_membership_check.sql
-- add_scanned_pantry_item is SECURITY DEFINER (bypasses RLS) but had no
-- membership check -- any authenticated user could write inventory into
-- any property, not just ones they belong to. Same pattern already used by
-- create_inventory_item_with_source (is_property_member helper).
create or replace function public.add_scanned_pantry_item(
  p_property_id uuid,
  p_name text,
  p_quantity numeric,
  p_ai_category text default null::text,
  p_ai_location_hint text default null::text,
  p_ai_kosher_guess text default null::text,
  p_photo_url text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_existing_id uuid;
  v_location_id uuid;
  v_result jsonb;
begin
  if p_property_id is null or p_name is null or trim(p_name) = '' then
    raise exception 'property_id and name are required';
  end if;

  if not is_property_member(p_property_id) then
    raise exception 'not a member of this property';
  end if;

  select id into v_existing_id
  from inventory_items
  where property_id = p_property_id
    and lower(name) = lower(trim(p_name))
  limit 1;

  if p_ai_location_hint is not null then
    select id into v_location_id
    from locations
    where property_id = p_property_id
      and name ilike '%' || p_ai_location_hint || '%'
    limit 1;
  end if;

  if v_location_id is null and p_ai_category is not null then
    select id into v_location_id
    from locations
    where property_id = p_property_id
      and (
        (p_ai_category = 'Fridge' and name ilike '%fridge%')
        or (p_ai_category = 'Freezer' and name ilike '%freezer%')
        or (p_ai_category = 'Pantry' and name ilike '%pantry%')
      )
    limit 1;
  end if;

  if v_existing_id is not null then
    update inventory_items
    set current_qty = p_quantity,
        photo_url = coalesce(p_photo_url, photo_url),
        location_id = coalesce(v_location_id, location_id),
        notes = case
          when p_ai_kosher_guess is not null then
            coalesce(notes || E'\n', '') || 'AI scan ' || now()::date ||
            ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
          else notes
        end,
        last_counted_at = now(),
        updated_at = now()
    where id = v_existing_id;

    v_result := jsonb_build_object('action', 'updated', 'id', v_existing_id, 'name', p_name);
  else
    insert into inventory_items (
      property_id, name, current_qty, location_id, photo_url, notes, last_counted_at
    ) values (
      p_property_id, trim(p_name), p_quantity, v_location_id, p_photo_url,
      case when p_ai_kosher_guess is not null then
        'AI scan ' || now()::date || ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
      else null end,
      now()
    )
    returning id into v_existing_id;

    v_result := jsonb_build_object('action', 'inserted', 'id', v_existing_id, 'name', p_name);
  end if;

  return v_result;
end;
$function$;
