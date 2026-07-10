-- Dip is a real course (108 live entries) but was never added to
-- course_icons when it was introduced.
insert into course_icons (course, icon_name, display_name)
values ('dip', 'Droplets', 'Dip');

-- Allow more than one entry for the same course on the same day (e.g. two
-- dips or two salads on Shabbos) -- meal_plan_entries_unique_slot_course
-- currently enforces exactly one row per (property_id, plan_date,
-- meal_slot, course), which is a hard block at the DB level regardless of
-- the UI. sequence defaults to 1 so every existing row is unaffected.
alter table meal_plan_entries add column sequence integer not null default 1;

alter table meal_plan_entries drop constraint meal_plan_entries_unique_slot_course;

alter table meal_plan_entries add constraint meal_plan_entries_unique_slot_course
  unique (property_id, plan_date, meal_slot, course, sequence);
