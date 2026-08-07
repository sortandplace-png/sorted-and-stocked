-- 222_sop_read_write_scoped_to_the_row.sql
-- SS-811. Applied live 6 Aug 2026.
--
-- sop_write had no correlation to the row being written -- qual and
-- with_check only asked whether the caller was a manager on ANY flagged
-- Sort + Place property, not whether that property had anything to do
-- with the specific SOP. sop_read was worse: FOR SELECT TO public USING
-- (auth.uid() IS NOT NULL) let any authenticated user of any household
-- read all 130 SOPs regardless of house.
--
-- Shared scope logic, used by both policies:
--   is_staple = true            -> every Sort + Place property qualifies,
--                                   full stop. Never narrowed by usage --
--                                   10 staples are currently used on one
--                                   house only and 1 on three, which is
--                                   incomplete rollout after Henderson
--                                   onboarded 6 Aug, not a wrong flag.
--   property_scope IS NOT NULL  -> exactly those houses (the 8 SOPs
--                                   Racquel just assigned, plus SOP-083
--                                   which already had a scope).
--   property_scope IS NULL      -> derive from master_tasks.sop_id (the
--                                   44 house-specific SOPs already in use
--                                   that predate explicit scoping).
--                                   Verified before writing this: every
--                                   one of the 44 has at least one
--                                   master_tasks row, so none derive to
--                                   an empty, unwritable scope.
create or replace function public.sop_visible_to_property(
  p_is_staple boolean,
  p_property_scope uuid[],
  p_sop_id uuid,
  p_property_id uuid
) returns boolean
language sql stable
set search_path to 'public'
as $$
  select p_is_staple
     or (p_property_scope is not null and p_property_id = any(p_property_scope))
     or (
          p_property_scope is null and not p_is_staple
          and exists (select 1 from master_tasks mt where mt.sop_id = p_sop_id and mt.property_id = p_property_id)
        )
$$;

-- READ: any role (staff must be able to follow an SOP, not just
-- managers) on a property the SOP is actually visible to. TO
-- authenticated, not TO public -- matching the load-bearing pattern from
-- migration 183/184 (SS-614), even though auth.uid() IS NOT NULL already
-- guarded anon safely here; consistent going forward is worth more than
-- "it happened to be fine this once."
drop policy if exists sop_read on public.sop_library;
create policy sop_read on public.sop_library
for select
to authenticated
using (
  exists (
    select 1 from property_members pm
    where pm.user_id = auth.uid()
      and public.sop_visible_to_property(sop_library.is_staple, sop_library.property_scope, sop_library.id, pm.property_id)
  )
);

-- WRITE: SS-800's manager-on-a-Sort+Place-property gate, PLUS the new
-- row-scope check. Both conditions on the same property_members row --
-- a manager qualifies only where they are BOTH a Sort + Place manager
-- AND on a house this specific SOP applies to.
drop policy if exists sop_write on public.sop_library;
create policy sop_write on public.sop_library
for all
to authenticated
using (
  exists (
    select 1 from property_members pm
    join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid()
      and pm.role = 'manager'
      and (p.feature_flags->>'sort_place_managed')::boolean is true
      and public.sop_visible_to_property(sop_library.is_staple, sop_library.property_scope, sop_library.id, pm.property_id)
  )
)
with check (
  exists (
    select 1 from property_members pm
    join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid()
      and pm.role = 'manager'
      and (p.feature_flags->>'sort_place_managed')::boolean is true
      and public.sop_visible_to_property(sop_library.is_staple, sop_library.property_scope, sop_library.id, pm.property_id)
  )
);

comment on function public.sop_visible_to_property is
  'SS-811. Shared by sop_read and sop_write. Staple SOPs are always visible everywhere Sort + Place operates, never narrowed by incomplete rollout. Scoped SOPs match property_scope exactly. Unscoped, non-staple SOPs (the pre-existing 44) derive their scope live from master_tasks.sop_id.';
comment on policy sop_read on public.sop_library is
  'SS-811. Any role (staff included) on a property this SOP is visible to -- staple, explicitly scoped, or derived from master_tasks usage. Replaces a blanket auth.uid() IS NOT NULL that let any authenticated user read all 130 SOPs.';
comment on policy sop_write on public.sop_library is
  'SS-811/SS-800. Manager on a Sort + Place-managed property that this specific SOP is also visible to. Replaces a check that only asked about the property, never the row.';
