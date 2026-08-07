-- 236_property_members_deactivate_not_delete.sql
-- SS-627. R21 says never delete; revoking a person's access has never had
-- any way to obey that rule, because property_members carries no active/
-- disabled flag at all -- the ONLY way to remove someone was a real DELETE.
-- Worse than just breaking R21: task_assignments.member_id is ON DELETE
-- CASCADE, so removing one property_members row silently destroyed that
-- person's real task-assignment history along with it, and
-- staff_tasks.assigned_to (ON DELETE SET NULL) lost its attribution too.
-- Offboarding someone was quietly deleting the record of what they'd done.
--
-- Fix is the same shape as staff_slots.active / printables.active
-- elsewhere in this schema: add the column, default true, teach the real
-- security boundary (the two SECURITY DEFINER functions almost every RLS
-- policy in the app calls through) to require it, and stop deleting.
--
-- Verified before writing this: exactly two app-code paths ever DELETE
-- from property_members -- components/StaffClient.tsx's removeMember()
-- and app/api/staff/offboard/route.ts. Both are updated in this same
-- commit to UPDATE active=false instead. No other call site exists
-- (grepped the whole app tree), so hardening the FK below is safe.

alter table public.property_members
  add column if not exists active boolean not null default true;

comment on column public.property_members.active is
  'SS-627. false = access revoked (per-property Remove, or full Offboard). Never delete the row -- history (task_assignments, activity log) stays attached to it. RLS (is_property_member/has_property_role) already excludes inactive rows from every read.';

-- THE security fix: these two functions are the choke point almost every
-- RLS policy in the app calls through (is_property_member for plain read
-- access, has_property_role for owner/manager-gated writes). Adding the
-- active check here means an offboarded person loses real access the
-- instant their row is deactivated, regardless of whether any of the ~60
-- app-code call sites that also read property_members remember to filter
-- on it -- the same "encode it once, centrally" rule SS-856 already
-- applied to operator-only routes.
create or replace function public.is_property_member(p_property_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.property_members pm
    where pm.property_id = p_property_id
      and pm.user_id = auth.uid()
      and pm.active
  );
$$;

create or replace function public.has_property_role(p_property_id uuid, p_roles member_role[])
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.property_members pm
    where pm.property_id = p_property_id
      and pm.user_id = auth.uid()
      and pm.role = any(p_roles)
      and pm.active
  );
$$;

-- The last-owner trigger only ever inspected `role` (a role CHANGE away
-- from owner) -- it had no idea `active` was about to exist, so it would
-- have silently allowed a manager to deactivate a property's only owner,
-- the exact case it exists to prevent. Treats "deactivated" as equivalent
-- to "removed" for this check.
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_property_id uuid;
  v_owner_count int;
begin
  v_property_id := coalesce(old.property_id, new.property_id);

  if old.role <> 'owner' or not old.active then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' and new.active then
    return new;
  end if;

  perform 1 from public.property_members where property_id = v_property_id for update;

  select count(*) into v_owner_count
  from public.property_members
  where property_id = v_property_id and role = 'owner' and active;

  if v_owner_count <= 1 then
    raise exception 'Cannot remove or demote the last owner of this property. Promote another member to owner first.';
  end if;

  return coalesce(new, old);
end;
$$;

-- Activity log previously fired only on a real DELETE or a role change --
-- an UPDATE that flips active to false is now the normal way someone is
-- removed, so it needs the same 'removed' entry a DELETE used to produce,
-- or the Team page's Activity feed goes silent on every future removal.
create or replace function public.log_property_member_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor_name text;
  v_member_name text;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    select full_name into v_member_name from public.profiles where id = new.user_id;
    insert into public.property_member_activity
      (property_id, member_user_id, member_name_snapshot, action_type, actor_user_id, actor_name, new_role)
    values
      (new.property_id, new.user_id, v_member_name, 'invited', auth.uid(), v_actor_name, new.role);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.active = false and old.active = true then
    select full_name into v_member_name from public.profiles where id = new.user_id;
    insert into public.property_member_activity
      (property_id, member_user_id, member_name_snapshot, action_type, actor_user_id, actor_name, old_role)
    values
      (new.property_id, new.user_id, v_member_name, 'removed', auth.uid(), v_actor_name, new.role);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    select full_name into v_member_name from public.profiles where id = new.user_id;
    insert into public.property_member_activity
      (property_id, member_user_id, member_name_snapshot, action_type, actor_user_id, actor_name, old_role, new_role)
    values
      (new.property_id, new.user_id, v_member_name, 'role_changed', auth.uid(), v_actor_name, old.role, new.role);
    return new;
  end if;

  if tg_op = 'DELETE' then
    select full_name into v_member_name from public.profiles where id = old.user_id;
    insert into public.property_member_activity
      (property_id, member_user_id, member_name_snapshot, action_type, actor_user_id, actor_name, old_role)
    values
      (old.property_id, old.user_id, v_member_name, 'removed', auth.uid(), v_actor_name, old.role);
    return old;
  end if;

  return null;
end;
$$;

-- Defense in depth: no app-code path deletes from property_members
-- anymore after this commit (verified: exactly two call sites existed,
-- both switched to UPDATE active=false in the same change). CASCADE here
-- meant a raw/future DELETE would silently take a real person's task
-- assignment history down with it with no error and no trace. RESTRICT
-- means that mistake now fails loudly instead of destroying data quietly.
alter table public.task_assignments
  drop constraint if exists task_assignments_member_id_fkey,
  add constraint task_assignments_member_id_fkey
    foreign key (member_id) references public.property_members(id) on delete restrict;
