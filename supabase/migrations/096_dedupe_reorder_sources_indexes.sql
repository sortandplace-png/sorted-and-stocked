-- reorder_sources carried two pairs of indexes doing the same job under
-- different names: one_preferred_source_per_item / reorder_sources_item_idx
-- pre-date this session's work entirely (present on the live table before
-- migration 092 ever ran, from whoever created the table originally) --
-- migration 092 added reorder_sources_one_preferred_per_item /
-- reorder_sources_inventory_item_id_idx without knowing equivalents already
-- existed. Harmless (both pairs enforce/serve the exact same thing) but
-- wasteful -- every write pays for two unique-partial-index checks and two
-- plain index updates instead of one. Keeping the reorder_sources_* names
-- since they match this table's own naming convention (reorder_sources_pkey,
-- reorder_sources_inventory_item_id_fkey, etc.); dropping the older pair.
drop index if exists public.one_preferred_source_per_item;
drop index if exists public.reorder_sources_item_idx;
