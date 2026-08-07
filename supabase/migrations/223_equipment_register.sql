-- 223_equipment_register.sql
-- SS-405. Applied live 6 Aug 2026. Built to the FINAL AGREED SPEC
-- (30 Jul, signed off) exactly. See the work_items row for the full
-- reasoning trail; nothing here re-derives it.

-- trades: NEW small bilingual table on the frequencies pattern, seeded
-- with exactly the four agreed values. Add more on demand, not by
-- guessing a full trades list up front.
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_en text not null,
  label_es text not null,
  sort_order integer not null default 0
);

alter table public.trades enable row level security;

drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades
  for select to authenticated using (true);

-- Sort + Place's own vocabulary, not a per-household thing -- gated the
-- same way as sop_write (SS-800/SS-811): manager on a Sort + Place
-- managed property.
drop policy if exists trades_write on public.trades;
create policy trades_write on public.trades
  for all to authenticated
  using (exists (
    select 1 from property_members pm join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid() and pm.role = 'manager' and (p.feature_flags->>'sort_place_managed')::boolean is true
  ))
  with check (exists (
    select 1 from property_members pm join properties p on p.id = pm.property_id
    where pm.user_id = auth.uid() and pm.role = 'manager' and (p.feature_flags->>'sort_place_managed')::boolean is true
  ));

insert into public.trades (code, label_en, label_es, sort_order) values
  ('plumber', 'Plumber', 'Plomero', 10),
  ('electrician', 'Electrician', 'Electricista', 20),
  ('hvac', 'HVAC', 'HVAC (Calefaccion y Aire)', 30),
  ('appliance_repair', 'Appliance Repair', 'Reparacion de Electrodomesticos', 40)
on conflict (code) do nothing;

-- equipment: name/name_es bilingual at creation (R19, same shape as
-- master_tasks.task_en/task_es). property_id NOT NULL -- the same
-- appliance at Main and Country is two rows, deliberately (frequency_id
-- is per-row precisely so the same appliance can run different
-- schedules at each house). room_id NULL for house-wide systems.
-- kosher_type constrained to Meat/Dairy only (SOP-067: a fridge or
-- freezer carries a FIXED meat-or-dairy status, never "parve" the way a
-- food item can be) -- null for everything that isn't a fridge/freezer.
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_es text not null,
  property_id uuid not null references public.properties(id),
  room_id uuid references public.rooms(id),
  trade_id uuid not null references public.trades(id),
  frequency_id uuid references public.frequencies(id),
  kosher_type text check (kosher_type is null or kosher_type in ('Meat', 'Dairy')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists equipment_property_idx on public.equipment (property_id);
create index if not exists equipment_room_idx on public.equipment (room_id);

alter table public.equipment enable row level security;

-- Same shape as rooms_read/rooms_write exactly.
drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment
  for select to authenticated using (is_property_member(property_id));

drop policy if exists equipment_write on public.equipment;
create policy equipment_write on public.equipment
  for all to authenticated
  using (exists (
    select 1 from property_members pm
    where pm.property_id = equipment.property_id and pm.user_id = auth.uid()
      and pm.role = any (array['owner','manager']::member_role[])
  ))
  with check (exists (
    select 1 from property_members pm
    where pm.property_id = equipment.property_id and pm.user_id = auth.uid()
      and pm.role = any (array['owner','manager']::member_role[])
  ));

-- equipment_consumables: a real join to inventory_items, never a free-
-- text field -- exactly the task_supplies precedent this ticket cites,
-- so a consumable carries its own reorder link and reaches the shopping
-- list. Capped at two per appliance in the UI ONLY, not the schema (the
-- join is the reversible direction; a single FK would not be) --
-- washing machines needing both a filter and hoses is the real case a
-- single-FK shape could not express.
create table if not exists public.equipment_consumables (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  created_at timestamptz not null default now()
);

create index if not exists equipment_consumables_equipment_idx on public.equipment_consumables (equipment_id);

alter table public.equipment_consumables enable row level security;

-- Same shape as task_supplies' supplies_read/supplies_write, joined
-- through equipment instead of master_tasks.
drop policy if exists equipment_consumables_read on public.equipment_consumables;
create policy equipment_consumables_read on public.equipment_consumables
  for select to authenticated
  using (exists (
    select 1 from equipment e where e.id = equipment_consumables.equipment_id and is_property_member(e.property_id)
  ));

drop policy if exists equipment_consumables_write on public.equipment_consumables;
create policy equipment_consumables_write on public.equipment_consumables
  for all to authenticated
  using (exists (
    select 1 from equipment e join property_members pm on pm.property_id = e.property_id
    where e.id = equipment_consumables.equipment_id and pm.user_id = auth.uid()
      and pm.role = any (array['owner','manager']::member_role[])
  ))
  with check (exists (
    select 1 from equipment e join property_members pm on pm.property_id = e.property_id
    where e.id = equipment_consumables.equipment_id and pm.user_id = auth.uid()
      and pm.role = any (array['owner','manager']::member_role[])
  ));

-- suppliers gains trade_id (nullable -- most existing suppliers are
-- retail stores with no trade, e.g. Amazon/Costco; only service
-- providers set it), household_id (backfilled from the property each
-- row already belongs to, then made NOT NULL), and property_id's
-- meaning widens: still narrowed to one house for every existing row,
-- but now NULL is a real, valid choice for a NEW household-wide
-- supplier -- Country being two hours from Main means distance-specific
-- trades are real, so narrowing must stay possible, just no longer
-- mandatory.
alter table public.suppliers
  add column if not exists trade_id uuid references public.trades(id),
  add column if not exists household_id uuid references public.households(id);

update public.suppliers s
set household_id = p.household_id
from public.properties p
where s.property_id = p.id
  and s.household_id is null;

alter table public.suppliers
  alter column household_id set not null;

create index if not exists suppliers_household_idx on public.suppliers (household_id);

comment on table public.equipment is
  'SS-405. Household equipment/appliance register. The same physical appliance at two properties is two rows on purpose -- frequency_id lives on the row, not a shared type, because the same fridge can run a different service schedule at Main vs Country.';
comment on column public.equipment.kosher_type is
  'SOP-067. Fridges/freezers carry a FIXED meat-or-dairy status, household law not preference. Null for anything that is not a fridge/freezer. Does NOT reopen inferring kashrus for other fixtures (SS-403) -- recording a declared appliance status is not the same as guessing a sink''s status.';
comment on table public.equipment_consumables is
  'SS-405. Join to inventory_items so a consumable (filter, salt, battery) carries its own reorder link and reaches the shopping list, same precedent as task_supplies. UI caps this at two per appliance; the schema does not, since join-to-single-FK is a one-line UI change while single-FK-to-join would have been a migration.';
comment on table public.trades is
  'SS-405. Small bilingual reference list (frequencies pattern) of service trades equipment declares a need for. Suppliers with a matching trade_id are the filtered picker offered for that equipment -- the trade is never bound to one supplier.';
comment on column public.suppliers.household_id is
  'SS-405. Backfilled from each row''s existing property_id at migration time. household_id is the real scope; property_id narrows to one house within it and is now optional for new rows (NULL = household-wide), though every pre-existing row keeps the single-property scope it already had.';
