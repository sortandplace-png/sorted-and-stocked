-- Staff Task Center: staff_tasks_all_member let ANY property member do
-- ANYTHING (view, create, edit, reassign, delete) with no role distinction
-- and no check on who a task was assigned to. Racquel's explicit spec:
-- staff see the full board (team visibility) but can only touch the
-- status/completed fields on their OWN assigned task -- no create, no
-- editing other fields, no reassigning, no deleting, including their own
-- task's other fields. Owner/manager keep full CRUD, unchanged.
--
-- Real gotcha caught before it shipped: staff_tasks.assigned_to is a FK to
-- property_members(id) -- the MEMBERSHIP row's id, not auth.uid() directly.
-- A first draft compared assigned_to = auth.uid() directly, which can
-- never match (different id spaces entirely) -- confirmed by a real insert
-- hitting the FK constraint during verification, not assumed. Every check
-- below resolves assigned_to through property_members to the real user.
--
-- Row-level access is real RLS (who can touch which rows at all). Which
-- COLUMNS a staff member may change within their own row is something RLS
-- alone can't express (it's row-scoped, not column-scoped) -- enforced by
-- a BEFORE UPDATE trigger instead.
drop policy if exists "staff_tasks_all_member" on public.staff_tasks;

create policy "staff_tasks_select_member"
  on public.staff_tasks for select
  using (is_property_member(property_id));

create policy "staff_tasks_insert_owner_manager"
  on public.staff_tasks for insert
  with check (has_property_role(property_id, array['owner', 'manager']::member_role[]));

create policy "staff_tasks_delete_owner_manager"
  on public.staff_tasks for delete
  using (has_property_role(property_id, array['owner', 'manager']::member_role[]));

create policy "staff_tasks_update_owner_manager_or_own_assigned"
  on public.staff_tasks for update
  using (
    has_property_role(property_id, array['owner', 'manager']::member_role[])
    or (
      has_property_role(property_id, array['staff']::member_role[])
      and assigned_to in (
        select pm.id from public.property_members pm
        where pm.property_id = staff_tasks.property_id and pm.user_id = auth.uid()
      )
    )
  )
  with check (
    has_property_role(property_id, array['owner', 'manager']::member_role[])
    or (
      has_property_role(property_id, array['staff']::member_role[])
      and assigned_to in (
        select pm.id from public.property_members pm
        where pm.property_id = staff_tasks.property_id and pm.user_id = auth.uid()
      )
    )
  );

create or replace function public.restrict_staff_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Owner/manager: no restriction beyond the RLS policy above.
  if has_property_role(new.property_id, array['owner', 'manager']::member_role[]) then
    return new;
  end if;

  -- Anyone reaching this point who isn't owner/manager must be a staff
  -- member updating their own assigned task (the RLS policy already
  -- blocked anything else from getting here) -- still checked explicitly
  -- rather than assumed, since this function is the actual enforcement
  -- boundary for column restrictions.
  if not (
    has_property_role(new.property_id, array['staff']::member_role[])
    and old.assigned_to in (
      select pm.id from public.property_members pm
      where pm.property_id = new.property_id and pm.user_id = auth.uid()
    )
  ) then
    raise exception 'Not authorized to update this task';
  end if;

  if new.title is distinct from old.title
     or new.assigned_to is distinct from old.assigned_to
     or new.due_date is distinct from old.due_date
     or new.created_by is distinct from old.created_by
     or new.notes is distinct from old.notes
     or new.priority is distinct from old.priority
     or new.category is distinct from old.category
     or new.property_id is distinct from old.property_id
  then
    raise exception 'Staff can only update task status, not other fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_staff_task_update on public.staff_tasks;
create trigger trg_restrict_staff_task_update
  before update on public.staff_tasks
  for each row execute function public.restrict_staff_task_update();
