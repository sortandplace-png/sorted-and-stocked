-- 226_fix_current_date_bodies.sql
-- SS-208. Applied live 6 Aug 2026.
--
-- Four function bodies, current_date/now()::date swapped for
-- public.eastern_today() -- nothing else about any of these changes.

create or replace function public.get_inventory_stats(p_property_id uuid)
returns table(total_items bigint, low_stock bigint, expiring_soon bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select
    count(*) as total_items,
    count(*) filter (where current_qty < min_qty) as low_stock,
    -- 14-day window is an assumption, matching no existing convention found for
    -- inventory specifically -- confirm/adjust against whatever the UI already implies
    count(*) filter (
      where expiration_date is not null
      and expiration_date between public.eastern_today() and public.eastern_today() + interval '14 days'
    ) as expiring_soon
  from inventory_items
  where property_id = p_property_id;
$function$;

create or replace function public.get_expiring_soon_recipes(p_property_id uuid, p_days_ahead integer DEFAULT 4)
returns table(recipe_id uuid, recipe_name text, recipe_name_es text, photo_url text, expiring_count bigint, expiring_ingredient_names text[])
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    r.id as recipe_id,
    r.name as recipe_name,
    r.name_es as recipe_name_es,
    r.photo_url,
    count(distinct ii.id) as expiring_count,
    array_agg(distinct ii.name order by ii.name) as expiring_ingredient_names
  from public.inventory_items ii
  join public.recipe_ingredients ri on ri.inventory_item_id = ii.id
  join public.recipes r on r.id = ri.recipe_id
  where ii.property_id = p_property_id
    and r.property_id = p_property_id
    and is_property_member(p_property_id)
    and ii.expiration_date is not null
    and ii.expiration_date >= public.eastern_today()
    and ii.expiration_date <= public.eastern_today() + (p_days_ahead || ' days')::interval
  group by r.id, r.name, r.name_es, r.photo_url
  order by expiring_count desc, r.name
  limit 20;
$function$;

create or replace function public.is_assigned_to_task(p_task_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.task_assignments ta
    left join public.property_members pm on pm.id = ta.member_id
    left join public.staff_slots ss on ss.id = ta.slot_id
    where ta.task_id = p_task_id
      and ta.active
      and ta.effective_from <= public.eastern_today()
      and (ta.effective_to is null or ta.effective_to >= public.eastern_today())
      and (
        pm.user_id = auth.uid()
        or (ss.user_id = auth.uid() and ss.active)
      )
  );
$function$;

create or replace function public.add_scanned_pantry_item(p_property_id uuid, p_name text, p_quantity numeric, p_ai_category text DEFAULT NULL::text, p_ai_location_hint text DEFAULT NULL::text, p_ai_kosher_guess text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_name_es text DEFAULT NULL::text)
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
        -- Opportunistic backfill only: never overwrite an existing
        -- translation, only fill a genuinely blank one.
        name_es = case
          when name_es is null or btrim(name_es) = '' then coalesce(nullif(btrim(p_name_es), ''), name_es)
          else name_es
        end,
        notes = case
          when p_ai_kosher_guess is not null then
            coalesce(notes || E'\n', '') || 'AI scan ' || public.eastern_today() ||
            ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
          else notes
        end,
        last_counted_at = now(),
        updated_at = now()
    where id = v_existing_id;

    v_result := jsonb_build_object('action', 'updated', 'id', v_existing_id, 'name', p_name);
  else
    -- name_es added (2026-07-20): trg_require_spanish/enforce_bilingual_required
    -- unconditionally rejects any insert with a blank name_es, and this branch
    -- never supplied one -- every new-item save through this RPC was failing.
    insert into inventory_items (
      property_id, name, name_es, current_qty, location_id, photo_url, notes, last_counted_at
    ) values (
      p_property_id, trim(p_name), nullif(btrim(p_name_es), ''), p_quantity, v_location_id, p_photo_url,
      case when p_ai_kosher_guess is not null then
        'AI scan ' || public.eastern_today() || ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
      else null end,
      now()
    )
    returning id into v_existing_id;

    v_result := jsonb_build_object('action', 'inserted', 'id', v_existing_id, 'name', p_name);
  end if;

  return v_result;
end;
$function$;
