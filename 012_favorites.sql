-- ============================================================================
-- 012: Favorites (per-user)
-- ============================================================================

create table public.inventory_item_favorites (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  inventory_item_id  uuid not null references public.inventory_items(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (property_id, inventory_item_id, user_id)
);

create index idx_favorites_user on public.inventory_item_favorites(property_id, user_id);

alter table public.inventory_item_favorites enable row level security;

-- Strictly own-favorites-only — this is per-person, not shared with the
-- household the way inventory itself is.
create policy "favorites_select_own"
  on public.inventory_item_favorites for select
  using (user_id = auth.uid());

create policy "favorites_insert_own"
  on public.inventory_item_favorites for insert
  with check (user_id = auth.uid() and public.is_property_member(property_id));

create policy "favorites_delete_own"
  on public.inventory_item_favorites for delete
  using (user_id = auth.uid());
