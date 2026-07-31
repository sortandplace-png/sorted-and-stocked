-- 147_reconcile_work_items_select_operator.sql
-- Reconciles a policy change already applied live by direct SQL, not a
-- migration (same reasoning as 138/145): SS-418.
--
-- TIMELINE, because three different states existed on 30 Jul:
--   1. 134_work_items_service_role_only dropped the last work_items policy
--      and revoked all table grants from authenticated/anon. Service-role
--      tooling only. That was the last state migrations knew about.
--   2. A later session shipped work_items_select_owner_manager -- SELECT for
--      any user who is owner/manager on ANY property. That commit (1d30354)
--      was never pushed to this repo and the policy never entered migration
--      history. It granted register read access to the Apple App Review
--      account (owner of five test properties, manager of QA Demo) and to a
--      client who owns her own residence. The register holds security
--      findings and credential-exposure history; that scope was wrong.
--   3. Claude replaced it live minutes later with the allow-list below
--      (SS-418). This migration records that final state.
--
-- CURRENT EFFECTIVE STATE, verified live 31 Jul 03:10 UTC before writing
-- this file: authenticated still has NO table grant on work_items (134's
-- revoke was never undone), so this policy grants nothing today. It exists
-- as defense-in-depth: if a table grant ever returns, SELECT is scoped to
-- Racquel's two operator accounts and nobody else. Do not restore open read
-- access (register decision, 30 Jul).
--
--   d4924019-58d1-49ec-97ae-25614e334340  racq1020@gmail.com
--   fb3edc16-1aa0-4a9c-b53a-8b04f741fe9d  sortandplace@gmail.com
--
-- Written idempotently; a no-op against the current database.

drop policy if exists work_items_select_owner_manager on work_items;
drop policy if exists work_items_select_operator on work_items;

create policy work_items_select_operator on work_items
  for select
  using (
    auth.uid() = any (array[
      'd4924019-58d1-49ec-97ae-25614e334340',
      'fb3edc16-1aa0-4a9c-b53a-8b04f741fe9d'
    ]::uuid[])
  );
