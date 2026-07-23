-- reorder_sources already exists live (created directly against the DB,
-- backfilled 1:1 from inventory_items.reorder_link, 738 rows). This
-- migration just brings the tracked history and repo in sync with what's
-- actually running, plus adds the one safety rail that was missing: a
-- partial unique index so "exactly one is_preferred per item" is a real
-- DB constraint, not just an application convention. Given tonight's
-- unrelated reorder_link data-integrity incident, that invariant is worth
-- enforcing at the DB level rather than trusting every future write path
-- to maintain it correctly.
create table if not exists public.reorder_sources (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  retailer_name text not null,
  url text not null,
  is_preferred boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reorder_sources_inventory_item_id_idx
  on public.reorder_sources (inventory_item_id);

create unique index if not exists reorder_sources_one_preferred_per_item
  on public.reorder_sources (inventory_item_id)
  where is_preferred;

alter table public.reorder_sources enable row level security;

drop policy if exists reorder_sources_select_member on public.reorder_sources;
create policy reorder_sources_select_member on public.reorder_sources
  for select using (is_property_member(property_id));

drop policy if exists reorder_sources_insert_member on public.reorder_sources;
create policy reorder_sources_insert_member on public.reorder_sources
  for insert with check (is_property_member(property_id));

drop policy if exists reorder_sources_update_member on public.reorder_sources;
create policy reorder_sources_update_member on public.reorder_sources
  for update using (is_property_member(property_id)) with check (is_property_member(property_id));

drop policy if exists reorder_sources_delete_owner_manager on public.reorder_sources;
create policy reorder_sources_delete_owner_manager on public.reorder_sources
  for delete using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));
