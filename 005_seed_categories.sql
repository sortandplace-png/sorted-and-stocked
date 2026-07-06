-- ============================================================================
-- 005: Category suggestions
-- ============================================================================
-- inventory_items.category stays free-text (not a foreign key) — locking it
-- down would break the low-stock trigger's denormalized copy onto
-- shopping_list_items and add friction for genuinely one-off categories.
-- This table exists purely to power an autocomplete/dropdown in the UI so
-- people aren't retyping "Paper Goods" with inconsistent capitalization.

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties(id) on delete cascade, -- null = global default
  name         text not null,
  created_at   timestamptz not null default now()
);

create index idx_categories_property_id on public.categories(property_id);

alter table public.categories enable row level security;

-- Global defaults (property_id is null) are readable by anyone signed in.
-- Property-specific custom categories are readable only by members.
create policy "categories_select_global_or_member"
  on public.categories for select
  using (
    property_id is null
    or public.is_property_member(property_id)
  );

-- Only members can add a custom category scoped to their property. Nobody
-- can insert global (property_id null) rows through the API — those are
-- seeded by migration only.
create policy "categories_insert_member"
  on public.categories for insert
  with check (
    property_id is not null
    and public.is_property_member(property_id)
  );

create policy "categories_delete_owner_manager"
  on public.categories for delete
  using (
    property_id is not null
    and public.has_property_role(property_id, array['owner','manager']::public.member_role[])
  );

-- Seed global defaults.
insert into public.categories (property_id, name) values
  (null, 'Kitchen'),
  (null, 'Pantry'),
  (null, 'Cleaning'),
  (null, 'Laundry'),
  (null, 'Paper Goods'),
  (null, 'Bathroom'),
  (null, 'Office'),
  (null, 'Electronics'),
  (null, 'Tools'),
  (null, 'Holiday'),
  (null, 'Freezer'),
  (null, 'Refrigerator'),
  (null, 'Baking'),
  (null, 'Snacks'),
  (null, 'Beverages'),
  (null, 'Medicine'),
  (null, 'Pet Supplies'),
  (null, 'Baby'),
  (null, 'Storage');
