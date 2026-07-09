-- ============================================================================
-- 040: "Ignore from inventory" flag on recipe_ingredients
-- ============================================================================
-- Distinct from is_food: is_food=false means "not a real purchasable
-- ingredient at all" (section headers, "salt and pepper to taste"). This new
-- flag means the opposite kind of case — a genuinely real ingredient
-- (water, salt) that a household deliberately doesn't want inventory-tracked.
-- Conflating the two under is_food would have required a "fake" reason for
-- why water isn't food, which it obviously is.

alter table public.recipe_ingredients
  add column if not exists ignored_from_inventory boolean not null default false;

comment on column public.recipe_ingredients.ignored_from_inventory is
  'True when a household has explicitly said this ingredient name should not be inventory-tracked (e.g. tap water) — distinct from is_food, which flags text that is not a real ingredient at all.';
