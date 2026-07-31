-- 153_task_assignments_slot_id.sql
-- SS-429, Racquel's ruling: option B. task_assignments gains a real link to
-- staff_slots, so a task can be assigned to a SLOT today -- while zero
-- staff accounts exist -- and whoever is later invited into that slot
-- inherits every task attached to it. This is what the Staff Slots helper
-- text has promised all along ("duties, assignments and history stay
-- attached to the slot"); option A (writing the label into role_label)
-- would have made assignment a string that renames break.
--
-- An assignment targets a member OR a slot, never both -- the check keeps
-- one row from meaning two different people once a slot gets linked. All
-- 193 existing rows have slot_id NULL and satisfy it trivially.

alter table task_assignments
  add column slot_id uuid references staff_slots(id);

create index task_assignments_slot_id_idx
  on task_assignments (slot_id) where slot_id is not null;

alter table task_assignments
  add constraint task_assignments_one_target
  check (member_id is null or slot_id is null);

-- is_assigned_to_task() is the single abstraction every read gate uses
-- (task visibility RLS, completion-insert scoping). Extended so a slot
-- assignment counts as "mine" the moment staff_slots.user_id links to the
-- viewer -- inheritance happens here, with no per-policy changes.
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
      and (
        pm.user_id = auth.uid()
        or ss.user_id = auth.uid()
      )
  );
$$;
