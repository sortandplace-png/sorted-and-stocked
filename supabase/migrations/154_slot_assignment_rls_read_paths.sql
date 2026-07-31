-- 154_slot_assignment_rls_read_paths.sql
-- SS-429 B, part two. 153 added task_assignments.slot_id and taught
-- is_assigned_to_task() about it, which covers tasks_read and the
-- completion-insert gate. Three policies still matched on member_id alone,
-- which would have made slot inheritance half-work: a staffer linked into a
-- slot could SEE the task (tasks_read) but not their own assignment row,
-- and not the completion history their teammates left on it.
--
--   assign_read              staff branch: own member rows only
--   completions_member_read  assigned-teammate branch: member join only
--   completions_member_update same branch, same gap
--
-- Each gains the slot arm: a row also counts as "mine" when its assignment
-- points at a staff slot whose user_id is the viewer. Owner/manager
-- branches unchanged.

alter policy assign_read on task_assignments
  using (
    member_id in (select pm.id from property_members pm where pm.user_id = auth.uid())
    or slot_id in (select ss.id from staff_slots ss where ss.user_id = auth.uid())
    or exists (
      select 1
      from master_tasks t
      join property_members pm on pm.property_id = t.property_id
      where t.id = task_assignments.task_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );

alter policy completions_member_read on task_completions
  using (
    completed_by = auth.uid()
    or exists (
      select 1
      from task_assignments ta
      left join property_members pm on pm.id = ta.member_id
      left join staff_slots ss on ss.id = ta.slot_id
      where ta.task_id = task_completions.task_id
        and (pm.user_id = auth.uid() or ss.user_id = auth.uid())
    )
    or exists (
      select 1 from property_members pm
      where pm.property_id = task_completions.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );

alter policy completions_member_update on task_completions
  using (
    completed_by = auth.uid()
    or exists (
      select 1
      from task_assignments ta
      left join property_members pm on pm.id = ta.member_id
      left join staff_slots ss on ss.id = ta.slot_id
      where ta.task_id = task_completions.task_id
        and (pm.user_id = auth.uid() or ss.user_id = auth.uid())
    )
    or exists (
      select 1 from property_members pm
      where pm.property_id = task_completions.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );
