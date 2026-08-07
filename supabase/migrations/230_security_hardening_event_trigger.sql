-- 230_security_hardening_event_trigger.sql
-- Applied live 6 Aug 2026.
--
-- Racquel: "Each of these was fixed before on other objects and came
-- back in new code. Make the hardening a check on new migrations, not a
-- one-time sweep." A note is not a control (the same lesson SS-817 built
-- for archiving) -- this is the database equivalent: an event trigger
-- that fires automatically on every future CREATE/REPLACE of a function
-- or view, checking it against the exact three patterns just found live
-- (SECURITY DEFINER view without security_invoker; function with a
-- mutable search_path; SECURITY DEFINER function still anon/PUBLIC-
-- executable), and RAISING A WARNING immediately in the migration's own
-- output. Nobody has to remember to run the advisor after the fact --
-- the check runs at the moment the object is created, every time,
-- forever.
--
-- WARNING, not a hard block: some of these are legitimate on purpose
-- (check_and_record_anon_rate_limit genuinely needs anon execute, for
-- instance) -- an unconditional block would break a real future
-- migration for a case this project actually wants. A visible warning at
-- creation time, impossible to miss in the migration output, is the
-- right strength: loud enough that a real oversight (like this one) gets
-- caught immediately, not strong enough to block an intentional exception.
--
-- VERIFIED before trusting this: fired correctly for an unhardened test
-- function (mutable search_path), an unhardened test view (no
-- security_invoker), and a SECURITY DEFINER test function left anon-
-- executable -- and stayed SILENT for a properly-hardened test function
-- (zero false positives). The RAISE WARNING text does not surface in
-- every SQL client's immediate response, but it is captured in the
-- project's own Postgres logs every time -- confirmed live via
-- get_logs, not assumed. All four test objects dropped after verifying.
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
end;
$$;

drop event trigger if exists trg_check_security_hardening;
create event trigger trg_check_security_hardening
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'CREATE VIEW')
  execute function public.check_security_hardening_on_ddl();

comment on function public.check_security_hardening_on_ddl() is
  'Fires on every future CREATE/CREATE OR REPLACE of a function or view in public. Warns (does not block) on the three defects found live tonight and already fixed once before (SS-606): SECURITY DEFINER views missing security_invoker, functions with a mutable search_path, and SECURITY DEFINER functions left anon/authenticated-executable. Racquel''s ruling: make the hardening a check on new migrations, not a one-time sweep -- a note is not a control.';
