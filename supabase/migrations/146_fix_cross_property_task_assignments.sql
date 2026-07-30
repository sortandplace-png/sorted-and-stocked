-- 146_fix_cross_property_task_assignments.sql
-- SS-401, and the tail of the Lax->Main task move in migration 145.
--
-- task_assignments references master_tasks(id), not property_id, so when
-- the 79 maintenance tasks moved to Main their assignments followed
-- silently. The room ids were caught and remapped by hand; nothing
-- surfaces member ids, so 156 active assignments were left pointing at LAX
-- property_members rows from Main tasks.
--
-- Two different problems needing two different fixes, which is why this is
-- not one blanket statement:
--
--   jessicahndrsn5@gmail.com (78) -- she is NOT a member of Main at all,
--     so there is no correct row to repoint to. DEACTIVATED, never
--     deleted, per R21: active=false plus effective_to=current_date, which
--     is exactly what effective_from/effective_to on this table are for.
--     The history stays readable.
--
--   sortandplace@gmail.com (78) -- she IS a Main member, so this is
--     recoverable rather than lost. REPOINTED to her Main
--     property_members row, preserving the assignment itself.
--
-- Checked before writing: task_assignments carries only a PK and two FKs,
-- no unique (task_id, member_id), so repointing could not collide with the
-- 14 older inactive rows she already has against Main tasks.
--
-- The pre-existing duplicate resolves as a side effect rather than by a
-- third statement: both sets covered the SAME 78 tasks, so deactivating
-- one and repointing the other leaves exactly one active assignment per
-- task. That duplicate was SS-401, carried across the move, not caused by
-- it -- it arose because both sets were inserted by direct SQL, bypassing
-- assignTask(), which deactivates prior assignments before inserting.
--
-- Written as a no-op against current data (already applied live).

-- Jessica: no valid membership on the task's property -> deactivate.
update task_assignments ta
set active = false, effective_to = current_date
from master_tasks mt, property_members pm, auth.users u
where ta.task_id = mt.id
  and ta.member_id = pm.id
  and pm.user_id = u.id
  and ta.active
  and pm.property_id <> mt.property_id
  and u.email = 'jessicahndrsn5@gmail.com';

-- Owner: valid membership exists on Main -> repoint, keep the assignment.
update task_assignments ta
set member_id = (
  select pm2.id
  from property_members pm2
  join properties p2 on p2.id = pm2.property_id
  join auth.users u2 on u2.id = pm2.user_id
  where p2.name = 'Main' and u2.email = 'sortandplace@gmail.com'
  limit 1
)
from master_tasks mt, property_members pm, auth.users u
where ta.task_id = mt.id
  and ta.member_id = pm.id
  and pm.user_id = u.id
  and ta.active
  and pm.property_id <> mt.property_id
  and u.email = 'sortandplace@gmail.com';

-- Verified live after applying:
--   cross-property active assignments ... 0
--   tasks with >1 active assignment ..... 0
--   total active ........................ 78  (one per task)
--   Jessica rows deactivated today ...... 78
--   total rows still present ............ 193 (nothing deleted)
