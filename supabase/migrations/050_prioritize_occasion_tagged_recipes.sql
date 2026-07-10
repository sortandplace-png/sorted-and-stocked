-- 050_prioritize_occasion_tagged_recipes.sql
-- No live "rotation algorithm" exists anywhere in this codebase -- the
-- full-year meal plan is a static, one-time-generated set of
-- meal_plan_entries rows (confirmed: strauss_meal_plan_import.sql is only
-- a ~15-day hand seed, not the full-year generator; no cron/edge-function/
-- random()-based selector exists in the app). So "prioritizing occasion-
-- tagged recipes" means directly correcting the existing rows for the
-- real holiday dates in yom_tov_dates that fall within the meal plan's
-- actual coverage (2026-06-21 to 2027-07-07), not patching a generator
-- that doesn't exist.
--
-- Rosh Hashana 1/2 2026 (9/12, 9/13): only rosh-hashana-tagged recipe is
-- Keftes de Prassa (vege, Parve) -- applied to both days since the tag
-- isn't day-specific.
update meal_plan_entries set recipe_id = '7de9d2b7-376a-473e-8420-5916a3dd55e2'
where property_id = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a'
  and plan_date in ('2026-09-12', '2026-09-13') and course = 'vege';

-- Shavuot 1 2027 (6/11): 7 shavuot-tagged recipes across soup/protein/
-- starch/dessert (none for salad/vege, left on the normal pool). All
-- tagged options + the untouched salad/vege picks are Dairy or Parve,
-- assembling a kashrut-consistent all-dairy Shavuot menu as a side
-- effect of tag-matching, not a separate check. starch had 4 tagged
-- options (Mini Spinach Frittatas, both Monkey Breads, Pizza Dough) --
-- picked alphabetically first, others are real alternatives.
update meal_plan_entries set recipe_id = 'a79ba120-15eb-48d8-86ea-51d91284011e' -- Broccoli Cheddar Soup
where property_id = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a' and plan_date = '2027-06-11' and course = 'soup';

update meal_plan_entries set recipe_id = '26e5dc28-9b9a-4393-8d3f-a47c7e7c4d2e' -- No Pot Creamy Ziti
where property_id = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a' and plan_date = '2027-06-11' and course = 'protein';

update meal_plan_entries set recipe_id = '45fd97dc-a157-4151-8c9d-28eee1803a5c' -- Mini Spinach Frittatas
where property_id = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a' and plan_date = '2027-06-11' and course = 'starch';

update meal_plan_entries set recipe_id = '9a38708e-f815-4b81-b380-d5bd2d1ba05a' -- Low Fat Cheesecake
where property_id = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a' and plan_date = '2027-06-11' and course = 'dessert';

-- Shavuot 2 2027 (6/12) NOT touched -- it has zero meal_plan_entries rows
-- at all (a pre-existing gap, out of scope: "not how many slots exist").
