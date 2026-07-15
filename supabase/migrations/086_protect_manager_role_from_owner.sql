-- 086_protect_manager_role_from_owner.sql
-- Real gap, confirmed live before this migration was written (not assumed):
-- property_members_update_owner_manager and property_members_delete_owner_manager
-- both only checked "is the acting user an owner OR manager of this property,"
-- with no check on the ROLE OF THE ROW BEING ACTED ON. That means an owner
-- account could UPDATE or DELETE a manager's own property_members row --
-- backwards from the intended model, where Manager is the Sort + Place /
-- Sorted & Stocked service account (the platform operator) and must be
-- protected from being edited, demoted, or removed by a household owner.
--
-- Fix: block UPDATE/DELETE specifically when the acting user is an owner
-- AND the target row's role is manager. Manager keeps full existing access
-- (can still manage owner/staff rows, including other managers -- this
-- migration only closes the owner-acting-on-manager gap, nothing else).
-- property_members_property_id_user_id_key (UNIQUE on property_id, user_id)
-- means a user can't simultaneously hold both roles on the same property,
-- but the extra "and not manager" check is kept for explicit, auditable
-- intent rather than relying silently on that invariant.

drop policy if exists property_members_update_owner_manager on public.property_members;
create policy property_members_update_owner_manager
  on public.property_members
  for update
  using (
    has_property_role(property_id, array['owner'::member_role, 'manager'::member_role])
    and not (
      role = 'manager'::member_role
      and has_property_role(property_id, array['owner'::member_role])
      and not has_property_role(property_id, array['manager'::member_role])
    )
  )
  with check (
    has_property_role(property_id, array['owner'::member_role, 'manager'::member_role])
    and not (
      role = 'manager'::member_role
      and has_property_role(property_id, array['owner'::member_role])
      and not has_property_role(property_id, array['manager'::member_role])
    )
  );

drop policy if exists property_members_delete_owner_manager on public.property_members;
create policy property_members_delete_owner_manager
  on public.property_members
  for delete
  using (
    has_property_role(property_id, array['owner'::member_role, 'manager'::member_role])
    and not (
      role = 'manager'::member_role
      and has_property_role(property_id, array['owner'::member_role])
      and not has_property_role(property_id, array['manager'::member_role])
    )
  );
