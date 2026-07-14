-- Guest & Family Taste Memory entries can optionally link to an existing
-- Contacts & Vendors row, so opening a person can show their contact info
-- (phone/email) alongside their taste notes.
alter table public.household_people
  add column contact_id uuid references public.household_contacts(id) on delete set null;
