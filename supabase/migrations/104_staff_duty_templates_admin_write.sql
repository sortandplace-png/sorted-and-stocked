-- staff_duty_templates only had a SELECT policy -- owner/manager could
-- read every row (per staff_duty_templates_select) but could not write to
-- it at all, since RLS default-denies any command with no permissive
-- policy for it. The new admin editor needs to update existing rows
-- (task/area text, staff_roster_key reassignment) and insert new ones
-- (e.g. Live-In duties, which currently has zero rows). Same
-- has_property_role(...) check already used by the existing select policy.
create policy "staff_duty_templates_insert"
  on staff_duty_templates for insert
  with check (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));

create policy "staff_duty_templates_update"
  on staff_duty_templates for update
  using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]))
  with check (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));
