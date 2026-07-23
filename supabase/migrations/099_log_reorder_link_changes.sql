-- log_inventory_item_change() tracked current_qty/name/location_id/category/
-- min_qty changes but never reorder_link -- confirmed by reading the live
-- function tonight. This is why the July 16 batch of 89 unauthorized
-- Amazon/Costco reorder-link writes was untraceable: not just that specific
-- incident, reorder_link changes have had zero audit trail for anyone, ever.
-- Adds one more check, following the exact same shape as the other five
-- (action_type 'updated', matching name/location_id/category/min_qty --
-- only current_qty uses the distinct 'quantity_changed' action_type).
-- search_path and SECURITY DEFINER left untouched; only the new IF block added.
CREATE OR REPLACE FUNCTION public.log_inventory_item_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_name text;
  v_actor_id uuid;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();
  v_actor_id := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_actor_name := coalesce(v_actor_name, 'System / Direct Database Access (no app session)');

  if tg_op = 'INSERT' then
    insert into public.inventory_item_history
      (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name)
    values
      (new.property_id, new.id, new.name, 'created', v_actor_id, v_actor_name);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.current_qty is distinct from old.current_qty then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'quantity_changed', v_actor_id, v_actor_name, 'current_qty', old.current_qty::text, new.current_qty::text);
    end if;
    if new.name is distinct from old.name then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', v_actor_id, v_actor_name, 'name', old.name, new.name);
    end if;
    if new.location_id is distinct from old.location_id then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', v_actor_id, v_actor_name, 'location_id', old.location_id::text, new.location_id::text);
    end if;
    if new.category is distinct from old.category then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', v_actor_id, v_actor_name, 'category', old.category, new.category);
    end if;
    if new.min_qty is distinct from old.min_qty then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', v_actor_id, v_actor_name, 'min_qty', old.min_qty::text, new.min_qty::text);
    end if;
    if new.reorder_link is distinct from old.reorder_link then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', v_actor_id, v_actor_name, 'reorder_link', old.reorder_link, new.reorder_link);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.inventory_item_history
      (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name)
    values
      (old.property_id, null, old.name, 'deleted', v_actor_id, v_actor_name);
    return old;
  end if;

  return null;
end;
$function$;
