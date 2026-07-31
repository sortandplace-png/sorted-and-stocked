-- 155_assignment_target_and_time_correctness.sql
-- Two gaps found in review of the SS-429 B work (31 Jul), fixed together
-- because they are the same idea: an assignment only MEANS something while
-- it is active, in its effective window, and pointing at exactly one thing.
--
-- 1. CONSTRAINT. task_assignments_one_target allowed member_id and slot_id
--    to both be null. Three real rows are like that -- all INACTIVE
--    historical closures from 20-23 Jul, which R21 forbids rewriting -- so
--    the tightened rule is scoped to rows in force: an ACTIVE assignment
--    must target exactly one of member or slot. Dead history stays as it
--    was written.
--
-- 2. FUNCTION. is_assigned_to_task() checked ta.active but ignored the
--    effective_from/effective_to window and staff_slots.active -- an
--    expired assignment, or one through a deactivated slot, still granted
--    task visibility and completion rights. Now: in-force window required,
--    and a slot assignment only counts while the slot itself is active.
--
-- 3. POLICIES, re-verified against the fixed function:
--    - completions_member_read / completions_member_update: the
--      assigned-teammate branch had NO active/window check at all (it
--      predates 154 and 154 kept its shape). Both now delegate to
--      is_assigned_to_task(), so "currently assigned" means one thing
--      everywhere. A PAST assignee keeps reading rows they logged
--      themselves via the completed_by arm; what they lose is visibility
--      of other people's completions on a task they no longer hold --
--      which is the point.
--    - assign_read: left as-is deliberately. It answers "which assignment
--      rows are about me", and someone's own ended assignment row is still
--      about them; My Day applies the time window in its own query.

alter table task_assignments drop constraint task_assignments_one_target;
alter table task_assignments add constraint task_assignments_one_target
  check (not active or num_nonnulls(member_id, slot_id) = 1);

create or replace function public.is_assigned_to_task(p_task_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.task_assignments ta
    left join public.property_members pm on pm.id = ta.member_id
    left join public.staff_slots ss on ss.id = ta.slot_id
    where ta.task_id = p_task_id
      and ta.active
      and ta.effective_from <= current_date
      and (ta.effective_to is null or ta.effective_to >= current_date)
      and (
        pm.user_id = auth.uid()
        or (ss.user_id = auth.uid() and ss.active)
      )
  );
$$;

alter policy completions_member_read on task_completions
  using (
    completed_by = auth.uid()
    or is_assigned_to_task(task_completions.task_id)
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
    or is_assigned_to_task(task_completions.task_id)
    or exists (
      select 1 from property_members pm
      where pm.property_id = task_completions.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
    )
  );
