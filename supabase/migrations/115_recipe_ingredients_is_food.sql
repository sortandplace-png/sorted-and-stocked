-- Recipe ingredient list was rendering equipment ("9- x 13-inch pan"),
-- sub-recipe cross-references ("basic chummus (recipe above)"), and stray
-- section-header/note lines ("Optional Toppings", section_label='Notes')
-- as if they were real food items, producing a nonsensical blank photo
-- tile (or, worse, an auto-generated photo slugified from the garbage
-- text itself -- confirmed live, e.g. a stock image literally titled
-- "you-can-also-use-dill-or-gherkins-if-the-pickles-are-large...jpg").
--
-- An is_food column already existed in production before this migration
-- (added by an earlier, undocumented pass) with 66 rows flagged false --
-- but using an over-broad heuristic that also hid real ingredients: every
-- "Water" row, real wine ("Herzog Lineage Chardonnay"), real cauliflower,
-- real herbs, real fruit. Nothing in the app reads this column yet
-- (confirmed: absent from RecipeDetailClient's Ingredient type and from
-- fetchRecipeWithIngredients' select list), so the bad data had zero live
-- effect -- safe to fully reset and re-curate by hand before wiring it in.
alter table recipe_ingredients
  add column if not exists is_food boolean not null default true;

comment on column recipe_ingredients.is_food is
  'False for equipment (e.g. a baking pan), a sub-recipe cross-reference '
  '(e.g. "basic chummus (recipe above)"), or a stray section-header/note '
  'line that ended up parsed into the ingredient list -- excluded from '
  'photo-tile rendering and from Add to Shopping List. True (default) for '
  'every real, purchasable ingredient, however vague ("Spices of your '
  'choice") or plainly phrased ("Water").';

update recipe_ingredients set is_food = true where is_food = false;

update recipe_ingredients
set is_food = false
where id in (
  'af50a44b-355e-43c1-8fcd-72a6b5fbb758', -- 9- x 13-inch pan (equipment)
  '45456071-8f6c-43d4-bae2-1b6ba191e3d4', -- Long wood skewers ... (equipment)
  '2f487e9d-c400-4cba-a15f-50babcfba427', -- empty 32-ounce jar (equipment/container)
  'dd7bcfb0-b42f-4c31-b69f-4832ba8c9fa1', -- basic chummus (recipe above)
  'fc06c7dd-0051-4a58-8ffa-392c2cab4f65', -- roasted chickpeas (recipe above)
  '4c6d17da-8718-4a9d-a927-1b4d7f5cdae0', -- Crisp White Wine Vinaigrette (alternative to the creamy dressing)
  '81224e3a-6398-4737-842d-72f03cc12776', -- Techina (Tahini Dip) -- for drizzling
  'e737313b-ae99-4303-85c8-5c613aeebab6', -- White Wine Dressing
  'b5755145-0df7-4cd2-9e76-399e381b0d60', -- recipe homemade mayonnaise
  'aa0b6cc1-a56e-4a34-99a3-953d90d414ec', -- Red Wine and Walnut Vinaigrette
  'f9da3534-ccb0-4f18-a61c-ab6fc097bf81', -- Optional Toppings (section-header leak)
  'c1852bcd-1f9d-451f-afad-cedcc774cdf7', -- Dressing / Approx. (section-header leak)
  '6c214d77-e091-48fe-8d2f-3857c550683e', -- Watermelon Layer (section-header leak)
  '7f771423-b4ff-4b07-a8d2-514877217ee4', -- Meatballs: 1/4 cup water (explanatory note, not a standalone ingredient)
  '54d27818-70d9-40b9-80df-f2ebd8221b49'  -- stray instructional sentence ("You can also use dill or gherkins...")
);
