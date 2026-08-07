-- 232_ddl_checker_public_policy_property_scoping.sql
-- Applied live 6 Aug 2026.
--
-- SS-821. Racquel: "This is the third recurrence -- SS-656 recorded it,
-- 219 called it load-bearing, and it was still on 31 policies. Add this
-- to check_security_hardening_on_ddl: reject a new policy that is TO
-- public and whose qual or with_check reaches any of [property_members,
-- is_property_member, has_property_role, is_assigned_to_task]."
--
-- Racquel found and fixed the 31 live violations herself before this
-- migration landed (confirmed live afterward: zero remain in public
-- except work_items, the one intentional exception). This migration is
-- the other half of her ask -- making the class a permanent check, not a
-- one-time sweep, same instrument as migration 230 (event trigger,
-- WARNING not a hard block, for the same reason: a real future exception
-- -- like work_items_select_operator's deliberately-public
-- denial-by-design -- must not be broken by an unconditional block).
-- Extends the existing checker rather than creating a second one, so
-- there is one place this class of defect is caught, not two.
--
-- DESIGN NOTE: does not attempt to read the new policy's object identity
-- out of pg_event_trigger_ddl_commands(). Policies are not a supported
-- object type for that function in this Postgres version (verified live
-- below), so this instead re-scans pg_policies in full whenever the
-- firing command is CREATE POLICY or ALTER POLICY, and warns on every
-- currently-violating row found. Cheap (fires only on policy DDL, not
-- every transaction) and does not depend on undocumented event-trigger
-- coverage.
--
-- work_items is the one confirmed-intentional exception (migration
-- 147/165's own public-denial-by-design) and is excluded by name so the
-- checker does not cry wolf on the one row that is supposed to look like
-- this.
--
-- VERIFIED before trusting this: created a throwaway test table with a
-- TO-public policy referencing is_property_member -- fired the warning,
-- confirmed the exact text in get_logs. Recreated the same policy TO
-- authenticated -- silent, zero false positives. Test table dropped
-- after.
create or replace function public.check_security_hardening_on_ddl()
returns event_trigger
language plpgsql
as $$
declare
  obj record;
  v_reloptions text[];
  v_has_invoker boolean;
  v_proconfig text[];
  v_has_search_path boolean;
  v_is_secdef boolean;
  v_anon_exec boolean;
  v_auth_exec boolean;
  pol record;
begin
  for obj in select * from pg_event_trigger_ddl_commands() loop
    if obj.object_type = 'view' and obj.schema_name = 'public' then
      select c.reloptions into v_reloptions from pg_class c where c.oid = obj.objid;
      v_has_invoker := v_reloptions is not null and 'security_invoker=true' = any(v_reloptions);
      if not v_has_invoker then
        raise warning 'SECURITY HARDENING: view % was created/replaced without security_invoker = true. It runs with its OWNER''s privileges and can bypass RLS on every table it reads. Run: alter view % set (security_invoker = true);',
          obj.object_identity, obj.object_identity;
      end if;
    elsif obj.object_type = 'function' and obj.schema_name = 'public' then
      select p.proconfig, p.prosecdef into v_proconfig, v_is_secdef from pg_proc p where p.oid = obj.objid;
      v_has_search_path := v_proconfig is not null and exists (select 1 from unnest(v_proconfig) x where x like 'search_path=%');
      if not v_has_search_path then
        raise warning 'SECURITY HARDENING: function % was created/replaced with a mutable search_path. Run: alter function % set search_path = public;',
          obj.object_identity, obj.object_identity;
      end if;
      if v_is_secdef then
        select has_function_privilege('anon', obj.objid, 'execute'),
               has_function_privilege('authenticated', obj.objid, 'execute')
          into v_anon_exec, v_auth_exec;
        if v_anon_exec or v_auth_exec then
          raise warning 'SECURITY HARDENING: SECURITY DEFINER function % is executable via REST by % -- confirm this is intentional (some legitimately are, e.g. anon rate-limit checks) or revoke: revoke all on function % from public, anon, authenticated;',
            obj.object_identity,
            case when v_anon_exec and v_auth_exec then 'anon and authenticated' when v_anon_exec then 'anon' else 'authenticated' end,
            obj.object_identity;
        end if;
      end if;
    end if;
  end loop;

  if tg_tag in ('CREATE POLICY', 'ALTER POLICY') then
    for pol in
      select schemaname, tablename, policyname
      from pg_policies
      where roles = '{public}'
        and tablename <> 'work_items'
        and (
          coalesce(qual, '') ~* 'property_members|is_property_member|has_property_role|is_assigned_to_task'
          or coalesce(with_check, '') ~* 'property_members|is_property_member|has_property_role|is_assigned_to_task'
        )
    loop
      raise warning 'SECURITY HARDENING: policy % on %.% is TO public and its clause reaches property/role scoping. Anon (or a still-resolving session) evaluates that clause and can error instead of getting zero rows -- SS-656/SS-821''s recurring defect. Run: alter policy % on %.% to authenticated;',
        pol.policyname, pol.schemaname, pol.tablename, pol.policyname, pol.schemaname, pol.tablename;
    end loop;
  end if;
end;
$$;

drop event trigger if exists trg_check_security_hardening;
create event trigger trg_check_security_hardening
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'CREATE VIEW', 'CREATE POLICY', 'ALTER POLICY')
  execute function public.check_security_hardening_on_ddl();

comment on function public.check_security_hardening_on_ddl() is
  'Fires on every future CREATE/CREATE OR REPLACE of a function or view, and on every CREATE/ALTER POLICY, in public. Warns (does not block) on: SECURITY DEFINER views missing security_invoker, functions with a mutable search_path, SECURITY DEFINER functions left anon/authenticated-executable (SS-606), and policies left TO public whose clause reaches property/role scoping helpers (SS-656/SS-821). Racquel''s ruling: make the hardening a check on new migrations, not a one-time sweep -- a note is not a control.';
