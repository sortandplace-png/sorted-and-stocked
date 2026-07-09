-- ============================================================================
-- 039: Property member activity log (invites, role changes, removals)
-- ============================================================================
-- Mirrors 011_item_history.sql's pattern: trigger-based, not client-side
-- logging, so every write path gets captured identically and can't be
-- faked from the client. Backs the Staff Management redesign's Activity Feed.

create table public.property_member_activity (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  member_name_snapshot text,
  action_type text not null check (action_type in ('invited','role_changed','removed')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  old_role text,
  new_role text,
  created_at timestamptz not null default now()
);

create index idx_property_member_activity_property on public.property_member_activity(property_id);

alter table public.property_member_activity enable row level security;

create policy property_member_activity_select on public.property_member_activity
  for select using (is_property_member(property_id));

create or replace function public.log_property_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
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

create trigger trg_log_property_member_change
  after insert or update or delete on public.property_members
  for each row execute procedure public.log_property_member_change();
