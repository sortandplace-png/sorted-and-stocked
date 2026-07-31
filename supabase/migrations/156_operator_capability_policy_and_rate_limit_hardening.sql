-- 156_operator_capability_policy_and_rate_limit_hardening.sql
-- Two review findings, 31 Jul.
--
-- 1. work_items_select_operator embedded two literal user UUIDs (Racquel's
--    two accounts). Replaced with the capability the UUIDs were standing in
--    for: an owner/manager membership on an operator-console property --
--    the same feature_flags.operator_console predicate the app's operator
--    gates use. Survives an account change, and extends to Blimie (or any
--    future operator) by giving them the membership, not by editing RLS.
--    Unchanged and still true: authenticated has NO table grant on
--    work_items (134's revoke), so this policy remains defense-in-depth
--    scoping, not an active read path.
--
-- 2. anon_rate_limit_events has RLS enabled with zero policies. CONFIRMED
--    DELIBERATE: its single access path is the SECURITY DEFINER rate-limit
--    function from 052_tier0, which bypasses RLS by design. But the table
--    still carried Supabase's default broad grants to anon/authenticated
--    -- inert today only because no policy exists, which is exactly the
--    footgun that fires the day someone adds a permissive policy. Revoked,
--    so the deny-all is structural instead of incidental. Commented on the
--    table so the next reviewer doesn't re-ask.

drop policy if exists work_items_select_operator on work_items;
create policy work_items_select_operator on work_items
  for select
  using (
    exists (
      select 1
      from property_members pm
      join properties p on p.id = pm.property_id
      where pm.user_id = auth.uid()
        and pm.role in ('owner', 'manager')
        and (p.feature_flags->>'operator_console')::boolean is true
    )
  );

revoke all on anon_rate_limit_events from anon;
revoke all on anon_rate_limit_events from authenticated;

comment on table anon_rate_limit_events is
  'Deny-all by design: RLS enabled, no policies, no client grants. The only access path is the SECURITY DEFINER rate-limit function (052_tier0). Do not add policies or grants here.';
