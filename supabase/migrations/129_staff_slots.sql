-- 129_staff_slots.sql
--
-- !! NOT YET APPLIED -- FOR REVIEW. !!
--
-- Property-scoped staff SLOTS: renameable labels that exist independently of
-- people. Slots start generic ("Housekeeper 1"), a manager renames one when a
-- real person starts, and each residence keeps its own set -- Main's staff are
-- not Lax's staff. Because slots exist without accounts, the workload bar and
-- Grab Pool become buildable now, before any staff account exists
-- (property_members is currently owner x5, manager x5, staff x0).
--
-- WHY THIS REPLACES staff_roster_key: today staff_duty_templates.staff_roster_key
-- is free text matched by string against property_members.staff_roster_key --
-- not a foreign key, nothing enforcing that the two sides agree, and no way to
-- rename a person without rewriting rows in both tables. All 61 duty rows hold
-- the single value 'unassigned', so there is no assignment data to migrate.

create table if not exists staff_slots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  slot_number integer not null,
  label_en text not null,
  label_es text not null,
  -- Linked only once a real account exists. Staff-facing UI shows label_en/es
  -- until then, and the account's own display name after -- never a name from
  -- a document, a seed, or a prompt.
  user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint staff_slots_property_slot_number_key unique (property_id, slot_number)
);

create index if not exists staff_slots_property_id_idx on staff_slots (property_id);
create index if not exists staff_slots_user_id_idx on staff_slots (user_id);

alter table staff_slots enable row level security;

-- Mirrors inventory_items exactly, same helper functions, same naming.
create policy "staff_slots_select_member" on staff_slots
  for select using (is_property_member(property_id));

create policy "staff_slots_insert_member" on staff_slots
  for insert with check (is_property_member(property_id));

create policy "staff_slots_update_member" on staff_slots
  for update using (is_property_member(property_id)) with check (is_property_member(property_id));

create policy "staff_slots_delete_owner_manager" on staff_slots
  for delete using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));

-- Seed 4 generic slots per property, every user_id null. Generated from
-- properties rather than hardcoded ids so a newly added residence is a
-- one-line re-run, and so this file contains no property-specific values.
insert into staff_slots (property_id, slot_number, label_en, label_es, sort_order)
select p.id, n, 'Housekeeper ' || n, 'Ama de llaves ' || n, n * 10
from properties p cross join generate_series(1, 4) as n
on conflict (property_id, slot_number) do nothing;

-- Point duty templates at slots.
alter table staff_duty_templates
  add column if not exists slot_id uuid references staff_slots(id) on delete set null;

-- The existing SELECT policy reads staff_roster_key, so it must be replaced
-- BEFORE the column can be dropped -- dropping first would fail on the
-- dependency. New rule: owners/managers see everything; a staff member sees
-- duties whose slot is linked to their own account. NULL slot_id = unassigned,
-- visible to owners/managers (and to staff via the Grab Pool, which will need
-- its own narrowly-scoped claim policy -- deliberately not added here).
drop policy if exists "staff_duty_templates_select" on staff_duty_templates;
create policy "staff_duty_templates_select" on staff_duty_templates
  for select using (
    has_property_role(property_id, array['owner'::member_role, 'manager'::member_role])
    or exists (
      select 1 from staff_slots s
      where s.id = staff_duty_templates.slot_id
        and s.user_id = auth.uid()
    )
  );

alter table staff_duty_templates drop column if exists staff_roster_key;

-- The table had INSERT/SELECT/UPDATE policies but no DELETE policy at all.
-- With RLS enabled that denies deletes to everyone, so duty templates could
-- only ever be removed by direct SQL. Added to match the slots/inventory_items
-- pattern.
create policy "staff_duty_templates_delete" on staff_duty_templates
  for delete using (
    has_property_role(property_id, array['owner'::member_role, 'manager'::member_role])
  );

comment on table staff_slots is
  'Property-scoped, renameable staff positions. Slots exist independently of accounts: label_en/label_es are shown until user_id links a real account, after which that account''s own display name is shown. Never store a person''s name here as a default.';
comment on column staff_slots.user_id is
  'Set only when a real account is linked. Null is the normal state.';
