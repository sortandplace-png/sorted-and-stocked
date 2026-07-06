-- ============================================================================
-- Dedup: removes duplicate recipes (same name, same property), keeping the
-- oldest copy of each and cascading to remove their orphaned ingredients.
-- Safe to run even if there are no duplicates.
-- ============================================================================
delete from public.recipes a
using public.recipes b
where a.property_id = b.property_id
  and a.name = b.name
  and a.id > b.id;
