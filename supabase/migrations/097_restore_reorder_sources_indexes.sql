-- 096 dropped the two duplicate-named indexes (one_preferred_source_per_item,
-- reorder_sources_item_idx), intending to leave this session's own pair
-- (reorder_sources_one_preferred_per_item, reorder_sources_inventory_item_id_idx)
-- in place. Checking immediately after, all four were gone -- not just the
-- two actually named in the DROP statements. Cause not fully diagnosed (a
-- Supabase/PostgREST schema-cache reload side effect around the DDL call is
-- the leading guess, not confirmed); noting it honestly rather than
-- pretending 096 alone was sufficient. Restores the real pair this table
-- needs: the partial unique index that enforces exactly one preferred
-- source per item (safety-critical -- reorder_sources_editor and the
-- set_preferred/delete_reorder_source functions all assume this holds),
-- and the plain lookup index on inventory_item_id.
create index if not exists reorder_sources_inventory_item_id_idx
  on public.reorder_sources (inventory_item_id);

create unique index if not exists reorder_sources_one_preferred_per_item
  on public.reorder_sources (inventory_item_id)
  where is_preferred;
