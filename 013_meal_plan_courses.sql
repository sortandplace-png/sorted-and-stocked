-- ============================================================================
-- 013: Meal plan courses (soup, protein, starch, salad, dessert, kids platter)
-- ============================================================================
-- The original meal_plan_entries design allowed one entry per day. Real
-- feedback: a real day has multiple independently-planned courses. This
-- adds a `course` tag to both recipes and entries so a day can have up to
-- 6 separate picks instead of one.

alter table public.recipes
  add column if not exists course text check (course in ('soup','protein','starch','salad','dessert','kids_platter'));

alter table public.meal_plan_entries
  add column if not exists course text not null default 'protein'
    check (course in ('soup','protein','starch','salad','dessert','kids_platter'));

create index if not exists idx_recipes_course on public.recipes(property_id, course);
create index if not exists idx_meal_plan_entries_course on public.meal_plan_entries(property_id, plan_date, course);

-- Tag the 23 real recipes imported from Week 1 with their actual course,
-- based on which column they came from in the original meal plan sheet.
update public.recipes set course = 'soup' where name in ('Elisheva Vegetable Chicken Soup', 'Tomato Soup');
update public.recipes set course = 'protein' where name in (
  'Teriyaki Quinoa Chicken', 'Eileen''s Sweet & Tangy Chicken', 'Oven-Baked Schnitzel',
  'Cedar Plank Salmon', 'Meatballs', 'Slow Cooker Pulled Beef', 'Flanken Roast', 'Pulled Brisket'
);
update public.recipes set course = 'starch' where name in ('Egg Noodles', 'Mediterranean Quinoa', 'Rice Pilaf', 'Roasted Potatoes', 'White Bean Medley');
update public.recipes set course = 'salad' where name in ('Cucumber Salad', 'Arugula Salad', 'Green Bean Salad', 'Beet Salad', 'Kale Salad');
update public.recipes set course = 'dessert' where name in ('Brownie Bites', 'Chocolate Cookies', 'Chocolate Cake');
