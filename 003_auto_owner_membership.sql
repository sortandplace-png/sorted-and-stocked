-- ============================================================================
-- 003: Auto-enroll property creator as owner
-- ============================================================================
-- Gap found while wiring up auth: a user could pass the properties_insert
-- RLS check (created_by = auth.uid()) and create a property, but nothing
-- added them to property_members — so is_property_member() would return
-- false for their own new property and every subsequent RLS check would
-- lock them out of the thing they just created.

create or replace function public.handle_new_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.property_members (property_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (property_id, user_id) do nothing;
  return new;
end;
$$;

create trigger trg_property_created
  after insert on public.properties
  for each row execute procedure public.handle_new_property();
