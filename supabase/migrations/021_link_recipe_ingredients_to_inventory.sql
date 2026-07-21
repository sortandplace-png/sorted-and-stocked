-- ============================================================================
-- 021: Link recipe_ingredients to inventory_items
-- ============================================================================
-- Reconciliation file (2026-07-21): this migration was applied live on
-- 2026-07-06 (tracked in supabase_migrations.schema_migrations as
-- 021_link_recipe_ingredients_to_inventory, version 20260706112657) but the
-- .sql file was never committed to this repo -- likely applied directly
-- rather than through a committed file, same as several other gaps found
-- in the 015-022 range during that reconciliation pass. Captured here
-- verbatim from Supabase's own tracked statement history so a fresh
-- clone/environment reproduces the same schema. Not re-run against the
-- live database -- inventory_item_id already exists there.

ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid
    REFERENCES inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item_id
  ON recipe_ingredients(inventory_item_id);

UPDATE recipe_ingredients ri
SET inventory_item_id = ii.id
FROM inventory_items ii
WHERE ri.inventory_item_id IS NULL
  AND lower(trim(ri.name)) = lower(trim(ii.name));
