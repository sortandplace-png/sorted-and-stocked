-- 206_henderson_staple_tasks.sql
-- Applied live 6 Aug 2026; repo copy written after the fact to close the
-- migration drift. NOTE: this migration has a defect, corrected by 207 --
-- read both together.

-- 206: the tasks behind Henderson's copied rooms.
--
-- Matched on ROOM NAME, because 205 created NEW rooms with new ids rather
-- than sharing Lax's. That is the one-way rule made concrete: no id in
-- common, so nothing can propagate back to Lax.
--
-- task_number is assigned EXPLICITLY from the current maximum. Its default
-- generator is behind the table (max is T-01034 while the default offered
-- T-00965, colliding with the unique index), because rows have been
-- inserted with explicit numbers without advancing it. Computing from
-- max() here sidesteps a generator this migration should not be repairing.
with lax as (select id from properties where name = 'Lax'),
hend as (select id from properties where name = 'Henderson'),
start as (
  select coalesce(max((regexp_replace(task_number, '\D', '', 'g'))::int), 0) as n from master_tasks
),
src as (
  select m.*, lr.name_en as room_name, lr.staple_repeatable
  from master_tasks m
  join rooms lr on lr.id = m.room_id
  join sop_library s on s.id = m.sop_id
  left join work_sections w on w.id = m.work_section_id
  where m.property_id = (select id from lax)
    and m.active and lr.is_staple and s.is_staple
    and not lr.staple_observant_only
    and (w.code is distinct from 'yom_tov_shabbos')
),
tgt as (
  select id, name_en, staple_repeatable from rooms where property_id = (select id from hend)
),
paired as (
  select s.*, t.id as target_room,
         row_number() over (order by t.name_en, s.sort_order, s.task_en) as rn
  from src s
  join tgt t
    on (s.staple_repeatable and t.staple_repeatable)
    or (not s.staple_repeatable and t.name_en = s.room_name)
)
insert into master_tasks (
  task_number, property_id, room_id, frequency_id, task_en, task_es, job_type,
  assigned_role, sop_id, source_area_en, source_area_es, active, sort_order,
  time_of_day, estimated_minutes, work_section_id, days_of_week
)
select 'T-' || lpad(((select n from start) + p.rn)::text, 5, '0'),
       (select id from hend), p.target_room, p.frequency_id, p.task_en, p.task_es,
       p.job_type, p.assigned_role, p.sop_id, p.source_area_en, p.source_area_es,
       true, p.sort_order, p.time_of_day, p.estimated_minutes, p.work_section_id, p.days_of_week
from paired p;
