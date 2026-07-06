-- ============================================================================
-- Multi-Tenant Property Inventory & Shopping List System
-- Supabase / PostgreSQL migration
-- ============================================================================
-- Run this in the Supabase SQL Editor. Idempotent-ish: uses IF NOT EXISTS
-- where possible, but enums/policies will error on re-run if already created.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.list_status as enum ('active', 'completed');
create type public.item_status as enum ('pending', 'purchased');

-- ----------------------------------------------------------------------------
-- 2. PROFILES  (extends auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data mirrored from auth.users.';

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. PROPERTIES
-- ----------------------------------------------------------------------------
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index idx_properties_created_by on public.properties(created_by);

-- ----------------------------------------------------------------------------
-- 4. PROPERTY_MEMBERS  (join table: profiles <-> properties)
-- ----------------------------------------------------------------------------
create table public.property_members (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.member_role not null default 'staff',
  joined_at    timestamptz not null default now(),
  unique (property_id, user_id)
);

create index idx_property_members_property_id on public.property_members(property_id);
create index idx_property_members_user_id on public.property_members(user_id);

-- ----------------------------------------------------------------------------
-- 5. LOCATIONS  (areas/zones within a property)
-- ----------------------------------------------------------------------------
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  name         text not null,          -- e.g. "Kitchen Pantry", "Linen Closet"
  created_at   timestamptz not null default now()
);

create index idx_locations_property_id on public.locations(property_id);

-- ----------------------------------------------------------------------------
-- 6. INVENTORY_ITEMS
-- ----------------------------------------------------------------------------
create table public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,
  name         text not null,
  category     text,                    -- e.g. 'Produce', 'Paper Goods', 'Cleaners' (drives aisle grouping)
  current_qty  numeric not null default 0,
  min_qty      numeric not null default 0,
  unit         text not null default 'pcs',   -- 'pcs', 'boxes', 'bottles', etc.
  qr_code      text unique,             -- token for QR/barcode scanning
  updated_at   timestamptz not null default now()
);

create index idx_inventory_items_property_id on public.inventory_items(property_id);
create index idx_inventory_items_location_id on public.inventory_items(location_id);
create index idx_inventory_items_qr_code on public.inventory_items(qr_code);
create index idx_inventory_items_low_stock on public.inventory_items(property_id) where current_qty < min_qty;

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. SHOPPING_LISTS
-- ----------------------------------------------------------------------------
create table public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  name         text not null default 'Shopping List',
  status       public.list_status not null default 'active',
  created_at   timestamptz not null default now()
);

create index idx_shopping_lists_property_id on public.shopping_lists(property_id);
create index idx_shopping_lists_active on public.shopping_lists(property_id) where status = 'active';

-- ----------------------------------------------------------------------------
-- 8. SHOPPING_LIST_ITEMS
-- ----------------------------------------------------------------------------
create table public.shopping_list_items (
  id                 uuid primary key default gen_random_uuid(),
  shopping_list_id   uuid not null references public.shopping_lists(id) on delete cascade,
  inventory_item_id  uuid references public.inventory_items(id) on delete set null, -- nullable: one-off items
  name               text not null,     -- denormalized so custom items don't need an inventory row
  category           text,              -- denormalized for aisle grouping even on custom items
  qty_needed         numeric not null default 1,
  status             public.item_status not null default 'pending',
  created_at         timestamptz not null default now()
);

create index idx_shopping_list_items_list_id on public.shopping_list_items(shopping_list_id);
create index idx_shopping_list_items_inventory_item_id on public.shopping_list_items(inventory_item_id);

-- ============================================================================
-- 9. HELPER FUNCTION: membership check
-- ============================================================================
-- SECURITY DEFINER + search_path pin so it can be safely used inside RLS
-- policies without recursive RLS evaluation issues.
create or replace function public.is_property_member(p_property_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.property_members pm
    where pm.property_id = p_property_id
      and pm.user_id = auth.uid()
  );
$$;

-- Role-aware variant, useful for write policies restricted to owner/manager.
create or replace function public.has_property_role(p_property_id uuid, p_roles public.member_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.property_members pm
    where pm.property_id = p_property_id
      and pm.user_id = auth.uid()
      and pm.role = any(p_roles)
  );
$$;

-- ============================================================================
-- 10. AUTOMATION: auto-generate shopping list item on low stock
-- ============================================================================
create or replace function public.handle_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
begin
  -- Only act when the item just crossed below its minimum threshold.
  if new.current_qty < new.min_qty
     and (tg_op = 'INSERT' or old.current_qty >= old.min_qty) then

    -- Find (or create) the property's active shopping list.
    select id into v_list_id
    from public.shopping_lists
    where property_id = new.property_id
      and status = 'active'
    order by created_at desc
    limit 1;

    if v_list_id is null then
      insert into public.shopping_lists (property_id, name, status)
      values (new.property_id, 'Shopping List', 'active')
      returning id into v_list_id;
    end if;

    -- Avoid duplicate pending entries for the same inventory item.
    if not exists (
      select 1 from public.shopping_list_items
      where shopping_list_id = v_list_id
        and inventory_item_id = new.id
        and status = 'pending'
    ) then
      insert into public.shopping_list_items
        (shopping_list_id, inventory_item_id, name, category, qty_needed, status)
      values
        (v_list_id, new.id, new.name, new.category,
         greatest(new.min_qty - new.current_qty, 1), 'pending');
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_inventory_low_stock
  after insert or update of current_qty, min_qty on public.inventory_items
  for each row execute procedure public.handle_low_stock();

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.properties          enable row level security;
alter table public.property_members    enable row level security;
alter table public.locations           enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.shopping_lists      enable row level security;
alter table public.shopping_list_items enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES: a user can see any profile of someone they share a property
-- with (needed to render staff names), but can only edit their own.
-- ---------------------------------------------------------------------------
create policy "profiles_select_shared_property"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.property_members pm1
      join public.property_members pm2 on pm1.property_id = pm2.property_id
      where pm1.user_id = auth.uid() and pm2.user_id = public.profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policies: profile rows are managed by the auth trigger.

-- ---------------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------------
create policy "properties_select_member"
  on public.properties for select
  using (public.is_property_member(id));

create policy "properties_insert_authenticated"
  on public.properties for insert
  with check (created_by = auth.uid());

create policy "properties_update_owner_manager"
  on public.properties for update
  using (public.has_property_role(id, array['owner','manager']::public.member_role[]))
  with check (public.has_property_role(id, array['owner','manager']::public.member_role[]));

create policy "properties_delete_owner"
  on public.properties for delete
  using (public.has_property_role(id, array['owner']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- PROPERTY_MEMBERS
-- ---------------------------------------------------------------------------
create policy "property_members_select_member"
  on public.property_members for select
  using (public.is_property_member(property_id));

create policy "property_members_insert_owner_manager"
  on public.property_members for insert
  with check (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

create policy "property_members_update_owner_manager"
  on public.property_members for update
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]))
  with check (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

create policy "property_members_delete_owner_manager"
  on public.property_members for delete
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------------------------
create policy "locations_select_member"
  on public.locations for select
  using (public.is_property_member(property_id));

create policy "locations_insert_member"
  on public.locations for insert
  with check (public.is_property_member(property_id));

create policy "locations_update_member"
  on public.locations for update
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "locations_delete_owner_manager"
  on public.locations for delete
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- INVENTORY_ITEMS
-- ---------------------------------------------------------------------------
create policy "inventory_items_select_member"
  on public.inventory_items for select
  using (public.is_property_member(property_id));

create policy "inventory_items_insert_member"
  on public.inventory_items for insert
  with check (public.is_property_member(property_id));

create policy "inventory_items_update_member"
  on public.inventory_items for update
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "inventory_items_delete_owner_manager"
  on public.inventory_items for delete
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- SHOPPING_LISTS
-- ---------------------------------------------------------------------------
create policy "shopping_lists_select_member"
  on public.shopping_lists for select
  using (public.is_property_member(property_id));

create policy "shopping_lists_insert_member"
  on public.shopping_lists for insert
  with check (public.is_property_member(property_id));

create policy "shopping_lists_update_member"
  on public.shopping_lists for update
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));

create policy "shopping_lists_delete_owner_manager"
  on public.shopping_lists for delete
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- SHOPPING_LIST_ITEMS  (scoped via parent shopping_lists.property_id)
-- ---------------------------------------------------------------------------
create policy "shopping_list_items_select_member"
  on public.shopping_list_items for select
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.shopping_list_id
        and public.is_property_member(sl.property_id)
    )
  );

create policy "shopping_list_items_insert_member"
  on public.shopping_list_items for insert
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.shopping_list_id
        and public.is_property_member(sl.property_id)
    )
  );

create policy "shopping_list_items_update_member"
  on public.shopping_list_items for update
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.shopping_list_id
        and public.is_property_member(sl.property_id)
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.shopping_list_id
        and public.is_property_member(sl.property_id)
    )
  );

create policy "shopping_list_items_delete_member"
  on public.shopping_list_items for delete
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = shopping_list_items.shopping_list_id
        and public.is_property_member(sl.property_id)
    )
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
