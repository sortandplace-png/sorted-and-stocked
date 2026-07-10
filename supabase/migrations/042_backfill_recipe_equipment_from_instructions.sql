-- 042_backfill_recipe_equipment_from_instructions.sql
-- One-time keyword inference over instructions_en + prep tags (9x13,
-- grill, slow-cooker) to seed recipes.equipment for existing recipes.
-- Deliberately conservative: only high-confidence, unambiguous keywords
-- are mapped. Recipes with no match are left null (no equipment guessed)
-- rather than forcing a value -- see session report for the breakdown of
-- how many recipes landed in each bucket.
update recipes set equipment = array_remove(array[
  case when instructions_en ~* 'slow cooker|crock ?pot' or tags @> array['slow-cooker'] then 'Slow Cooker' end,
  case when instructions_en ~* 'instant pot|pressure cooker' then 'Instant Pot' end,
  case when instructions_en ~* '9x13|9"x13"|9 x 13' or tags @> array['9x13'] then '9x13 Pan' end,
  case when instructions_en ~* 'baking sheet|sheet pan|cookie sheet' then 'Baking Sheet' end,
  case when instructions_en ~* 'food processor' then 'Food Processor' end,
  case when instructions_en ~* 'immersion blender' then 'Immersion Blender' end,
  case when instructions_en ~* 'blender' and instructions_en !~* 'immersion blender' then 'Blender' end,
  case when instructions_en ~* 'stand mixer|hand mixer|electric mixer' then 'Mixer' end,
  case when instructions_en ~* 'mixing bowl' then 'Mixing Bowl' end,
  case when instructions_en ~* 'grill' or tags @> array['grill'] then 'Grill' end,
  case when instructions_en ~* 'griddle' then 'Griddle' end,
  case when instructions_en ~* 'dutch oven' then 'Dutch Oven' end,
  case when instructions_en ~* 'roasting pan' then 'Roasting Pan' end,
  case when instructions_en ~* 'muffin tin|muffin pan|cupcake pan' then 'Muffin Tin' end,
  case when instructions_en ~* 'loaf pan' then 'Loaf Pan' end,
  case when instructions_en ~* 'skillet|frying pan|saut(e|é) pan' then 'Skillet' end,
  case when instructions_en ~* 'air fryer' then 'Air Fryer' end,
  case when instructions_en ~* 'waffle iron' then 'Waffle Iron' end,
  case when instructions_en ~* 'bundt pan' then 'Bundt Pan' end,
  case when instructions_en ~* 'cast iron' then 'Cast Iron Pan' end,
  case when instructions_en ~* 'rolling pin' then 'Rolling Pin' end,
  case when instructions_en ~* 'kitchen torch|blowtorch' then 'Kitchen Torch' end,
  case when instructions_en ~* 'ice cream maker|ice cream machine' then 'Ice Cream Maker' end
], null)
where equipment is null;
