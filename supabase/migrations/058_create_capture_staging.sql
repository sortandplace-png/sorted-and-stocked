-- Manual photo/note uploads (a recipe photo, a pantry restock note, a menu
-- change) land here first as unstructured JSON, get reviewed, then get
-- written into the real recipes / inventory_items / meal_plan_entries
-- tables on approval -- never write directly to production tables from a
-- raw upload.
--
-- submitted_by references profiles(id) directly, not property_members
-- (user_id) as originally drafted -- property_members.user_id is only
-- unique in combination with property_id, not on its own, so a bare FK to
-- it isn't valid. profiles(id) is the same table property_members itself
-- references for user_id.
create table capture_staging (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  submitted_by uuid references profiles(id),
  capture_type text check (capture_type in ('recipe','inventory','meal_plan')),
  raw_payload jsonb not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table capture_staging enable row level security;

create policy "capture_staging: members can insert their own property's captures"
  on capture_staging for insert
  with check (
    exists (
      select 1 from property_members pm
      where pm.property_id = capture_staging.property_id and pm.user_id = auth.uid()
    )
  );

create policy "capture_staging: members can read their own property's captures"
  on capture_staging for select
  using (
    exists (
      select 1 from property_members pm
      where pm.property_id = capture_staging.property_id and pm.user_id = auth.uid()
    )
  );

-- Reviewing (approve/reject) is a manager action, same bar as staff/page.tsx.
create policy "capture_staging: managers can update their own property's captures"
  on capture_staging for update
  using (
    exists (
      select 1 from property_members pm
      where pm.property_id = capture_staging.property_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner','manager')
    )
  );
