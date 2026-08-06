-- 207_fix_henderson_bedroom_task_duplication.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.

-- 207: corrects a defect in 206.
--
-- 206 joined Lax's repeatable-room tasks to Henderson's bedrooms on
-- "both are repeatable", which is a CROSS JOIN: Lax has TWO template
-- bedrooms carrying 11 tasks each, so all 22 were copied into each of
-- Henderson's 3 bedrooms. 66 bedroom tasks instead of 33, and 200 total
-- instead of 167.
--
-- staple_repeatable marks a room as an INSTANCE of a type, not as two
-- distinct rooms to merge. The fix takes ONE template bedroom.
with h as (select id from properties where name='Henderson'),
lax as (select id from properties where name='Lax'),
-- One template: the lowest-numbered Lax repeatable bedroom.
tpl as (
  select r.id from rooms r
  where r.property_id=(select id from lax) and r.is_staple and r.staple_repeatable
  order by r.name_en limit 1
),
bedrooms as (
  select id, name_en from rooms
  where property_id=(select id from h) and staple_repeatable
),
wipe as (
  delete from master_tasks
  where property_id=(select id from h)
    and room_id in (select id from bedrooms)
  returning 1
),
start as (
  select coalesce(max((regexp_replace(task_number,'\D','','g'))::int),0) as n
  from master_tasks where property_id <> (select id from h) or room_id not in (select id from bedrooms)
),
src as (
  select m.* from master_tasks m
  join sop_library s on s.id=m.sop_id
  where m.property_id=(select id from lax) and m.active
    and m.room_id=(select id from tpl) and s.is_staple
),
paired as (
  select s.*, b.id as target_room,
         row_number() over (order by b.name_en, s.sort_order, s.task_en) as rn
  from src s cross join bedrooms b
)
insert into master_tasks (
  task_number, property_id, room_id, frequency_id, task_en, task_es, job_type,
  assigned_role, sop_id, source_area_en, source_area_es, active, sort_order,
  time_of_day, estimated_minutes, work_section_id, days_of_week
)
select 'T-' || lpad(((select n from start) + 1000 + p.rn)::text, 5, '0'),
       (select id from h), p.target_room, p.frequency_id, p.task_en, p.task_es,
       p.job_type, p.assigned_role, p.sop_id, p.source_area_en, p.source_area_es,
       true, p.sort_order, p.time_of_day, p.estimated_minutes, p.work_section_id, p.days_of_week
from paired p;
