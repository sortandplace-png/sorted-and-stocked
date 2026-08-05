-- 193_work_sections.sql
-- Racquel's ruling: Home Maintenance, and Yom Tov and Shabbos, are their
-- own sections. They are not housekeeping and they never will be.
--
-- A LOOKUP TABLE, NOT A CHECK AND NOT FREE TEXT. Two reasons, both of
-- which a CHECK fails:
--   1. Every filter label needs Spanish. A CHECK constrains a value, it
--      cannot carry label_es, so the Spanish would end up hardcoded in the
--      component, which is where translations go to rot.
--   2. Racquel added two sections today alone. A CHECK means a migration
--      for each one. A row does not.
-- Same shape as public.frequencies, deliberately: code, label_en,
-- label_es, sort_order.
--
-- DELIBERATELY NOT job_type. That column already holds a 14 value
-- snake_case TRADE taxonomy (bathroom_cleaning, floors, laundry,
-- dusting_surfaces, glass_mirrors, kitchen_dishes, bed_making,
-- trash_disinfecting, organizing, maintenance, childcare, shades_windows,
-- outdoor_perimeter, general_tidying). That is what KIND of work it is.
-- work_section is which PART OF THE HOUSE'S LIFE it belongs to. A task can
-- be job_type 'organizing' and work_section 'yom_tov_shabbos' at once.
-- Folding them would also fork job_type into mixed case and give the Job
-- filter two entries for one kind of work.

create table if not exists public.work_sections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_en text not null,
  label_es text not null,
  sort_order integer not null
);

-- Idempotent: re-running must not duplicate, and must not silently revert
-- a label Racquel has corrected. Only sort_order is re-asserted.
insert into public.work_sections (code, label_en, label_es, sort_order) values
  ('housekeeping',     'Housekeeping',         'Limpieza',                     1),
  ('home_maintenance', 'Home Maintenance',     'Mantenimiento del hogar',      2),
  ('yom_tov_shabbos',  'Yom Tov and Shabbos',  'Yom Tov y Shabat',             3),
  ('childcare_family', 'Childcare and Family', 'Cuidado de niños y familia',   4)
on conflict (code) do update set sort_order = excluded.sort_order;

alter table public.master_tasks
  add column if not exists work_section_id uuid references public.work_sections(id);

create index if not exists master_tasks_work_section_idx
  on public.master_tasks (work_section_id);

-- RLS. work_sections is a label table with no per-property data in it, the
-- same as frequencies: every signed-in user needs to read it to render a
-- filter, and nobody edits it from the app.
alter table public.work_sections enable row level security;

drop policy if exists work_sections_select_authenticated on public.work_sections;
create policy work_sections_select_authenticated
  on public.work_sections for select to authenticated using (true);

-- BACKFILL FROM TASK TEXT, most specific first.
--
-- ORDER MATTERS AND IS NOT ALPHABETICAL. Yom Tov runs BEFORE maintenance,
-- because "replace the mezuzah" and "kasher the water filter" contain
-- maintenance words but are halachic work. Childcare runs before
-- housekeeping for the same reason. Housekeeping is last and takes
-- everything left, which matches the live classification: 907 of 998.
--
-- Only rows with no section yet are touched, so a hand correction by
-- Racquel is never overwritten by a re-run.
update public.master_tasks t
   set work_section_id = (select id from public.work_sections where code = 'yom_tov_shabbos')
 where t.work_section_id is null
   and (
     lower(coalesce(t.task_en,'')) ~ '(pesach|chametz|chometz|shabbos|yom tov|sukkos|mezuz|kasher|seder|matzah|tzedakah|sefer|seforim|shaimos)'
   );

update public.master_tasks t
   set work_section_id = (select id from public.work_sections where code = 'childcare_family')
 where t.work_section_id is null
   and (
     lower(coalesce(t.task_en,'')) ~ '(childcare|bedtime|backpack|lunchbox|car seat|stroller)'
   );

update public.master_tasks t
   set work_section_id = (select id from public.work_sections where code = 'home_maintenance')
 where t.work_section_id is null
   and (
     lower(coalesce(t.task_en,'')) ~ '(replace the|filter|anode|hose|chimney|water softener|light bulb|irrigation|dripper|pest control|timer)'
   );

update public.master_tasks t
   set work_section_id = (select id from public.work_sections where code = 'housekeeping')
 where t.work_section_id is null;

comment on column public.master_tasks.work_section_id is
  'Which part of the house''s life this task belongs to. A DIFFERENT AXIS from job_type, which is the trade taxonomy: a task can be job_type organizing and work_section yom_tov_shabbos at once. Backfilled from task text by migration 193; hand corrections are never overwritten by a re-run.';
