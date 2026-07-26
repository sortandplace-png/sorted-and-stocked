-- 125_master_products.sql
--
-- !! NOT YET APPLIED -- AWAITING REVIEW (SS-327). !!
-- Unlike every other migration in this directory, this one has NOT been run
-- against the database. It was explicitly requested as "show me the migration
-- before applying." Do not assume master_products exists in any environment
-- because this file does. Verified absent from the live DB as of 2026-07-26.
--
-- Product-variant grouping ("Master Product") -- additive only. Nothing
-- existing is restructured, no data is migrated, no rows are merged.
-- Grouping is opt-in per item: master_product_id stays nullable forever,
-- an ungrouped inventory_items row is the normal case, not an error state.
-- Never auto-grouped by name-match, fuzzy or exact -- that guesswork has
-- caused real problems on this project before (kashrut was once guessed
-- from a recipe's NAME via substring match; "Butternut Squash and Apple
-- Soup," real kosher_type Parve, matched "butter" inside "Butternut").
-- No UI in this pass; schema and RLS only.

create table if not exists master_products (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  name_es text, -- bilingual at creation time, never backfilled
  created_at timestamptz not null default now()
);

create unique index if not exists master_products_property_name_unique
  on master_products (property_id, lower(name));

alter table inventory_items
  add column if not exists master_product_id uuid references master_products(id) on delete set null;

alter table inventory_items
  add column if not exists variant_label text;

create index if not exists inventory_items_master_product_id_idx
  on inventory_items (master_product_id);

alter table master_products enable row level security;

-- Mirrors inventory_items' own policies exactly (same helper functions,
-- same names with the table prefix swapped) -- not a new pattern.
create policy "master_products_select_member" on master_products
  for select using (is_property_member(property_id));

create policy "master_products_insert_member" on master_products
  for insert with check (is_property_member(property_id));

create policy "master_products_update_member" on master_products
  for update using (is_property_member(property_id)) with check (is_property_member(property_id));

create policy "master_products_delete_owner_manager" on master_products
  for delete using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));
