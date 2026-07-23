-- staff_duty_templates_insert/_update (migration 104) were created without
-- a TO clause, defaulting to {public} -- inconsistent with
-- staff_duty_templates_select, which is scoped TO authenticated.
-- Functionally harmless (has_property_role() reads auth.uid(), which is
-- null for anon requests, so the check still fails either way) but the
-- {public} role list is misleading to read and makes Postgres evaluate
-- the policy for anon connections for no reason. Narrowing to match.
alter policy "staff_duty_templates_insert" on staff_duty_templates to authenticated;
alter policy "staff_duty_templates_update" on staff_duty_templates to authenticated;
