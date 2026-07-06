-- ============================================================================
-- 016: Re-link meal plan entries to the full recipe replacement
-- ============================================================================
-- strauss_recipes_import.sql (run just before this) deleted and fully
-- replaced the recipes table. Existing meal_plan_entries kept their
-- custom_name (real dish text) throughout, but recipe_id went null since
-- the old recipe rows no longer exist. This reconnects recipe_id wherever
-- the dish name matches a recipe in the new, complete set — which now
-- covers far more dishes than before, so more days should link up than
-- did originally.

update public.meal_plan_entries e
set recipe_id = r.id
from public.recipes r
where e.property_id = (select id from public.properties where name = 'Strauss' limit 1)
  and r.property_id = e.property_id
  and e.recipe_id is null
  and e.custom_name is not null
  and r.name = e.custom_name
  and (r.course = e.course or r.course is null);
