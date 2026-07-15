-- Ingredient-level counterpart to trg_log_recipe_change (title/method).
-- Skips ingredient_added events for recipes created <1 min ago, so a new
-- recipe's initial ingredient list doesn't flood recipe_versions the same
-- way the recipes-table trigger avoids logging on INSERT.
create or replace function public.log_recipe_ingredient_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_editor_name text;
  v_property_id uuid;
  v_recipe_id uuid;
  v_old_desc text;
  v_new_desc text;
  v_recipe_is_new boolean;
begin
  select full_name into v_editor_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    v_recipe_id := new.recipe_id;
    select property_id, (created_at > now() - interval '1 minute')
      into v_property_id, v_recipe_is_new
      from public.recipes where id = v_recipe_id;
    if v_recipe_is_new then
      return new;
    end if;
    v_new_desc := trim(concat_ws(' ', new.quantity, new.unit, new.name));
    insert into public.recipe_versions (recipe_id, property_id, field_name, old_value, new_value, edited_by, editor_name)
    values (v_recipe_id, v_property_id, 'ingredient_added', null, v_new_desc, auth.uid(), v_editor_name);
    return new;

  elsif tg_op = 'DELETE' then
    v_recipe_id := old.recipe_id;
    select property_id into v_property_id from public.recipes where id = v_recipe_id;
    v_old_desc := trim(concat_ws(' ', old.quantity, old.unit, old.name));
    insert into public.recipe_versions (recipe_id, property_id, field_name, old_value, new_value, edited_by, editor_name)
    values (v_recipe_id, v_property_id, 'ingredient_removed', v_old_desc, null, auth.uid(), v_editor_name);
    return old;

  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name
       or new.quantity is distinct from old.quantity
       or new.unit is distinct from old.unit then
      v_recipe_id := new.recipe_id;
      select property_id into v_property_id from public.recipes where id = v_recipe_id;
      v_old_desc := trim(concat_ws(' ', old.quantity, old.unit, old.name));
      v_new_desc := trim(concat_ws(' ', new.quantity, new.unit, new.name));
      insert into public.recipe_versions (recipe_id, property_id, field_name, old_value, new_value, edited_by, editor_name)
      values (v_recipe_id, v_property_id, 'ingredient_changed', v_old_desc, v_new_desc, auth.uid(), v_editor_name);
    end if;
    return new;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_log_recipe_ingredient_change on public.recipe_ingredients;
create trigger trg_log_recipe_ingredient_change
after insert or update or delete on public.recipe_ingredients
for each row execute function public.log_recipe_ingredient_change();
