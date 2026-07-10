-- 'dip' is a valid recipes.course value (13 recipes) but was never added to
-- meal_plan_entries' course CHECK constraint, so every attempt to schedule a
-- dip course entry was silently rejected by Postgres.
alter table public.meal_plan_entries
  drop constraint meal_plan_entries_course_check;

alter table public.meal_plan_entries
  add constraint meal_plan_entries_course_check
  check (course = any (array['soup', 'protein', 'starch', 'salad', 'dessert', 'kids_platter', 'vege', 'dip']));
