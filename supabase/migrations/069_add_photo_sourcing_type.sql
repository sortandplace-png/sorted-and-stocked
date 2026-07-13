-- Durable BRANDED/GENERIC classification for the inventory photo-sourcing
-- workflow: branded items get manual photos (taken during the physical
-- inventory count that's already needed, current_qty is 0 for nearly
-- everything); generic items get tried against licensed sources first,
-- AI-generation as a last resort where actually available. Classified live
-- via a real brand-keyword match against names verified to exist in this
-- database, not a blind assumed list -- see the pilot session's memory
-- record for the exact keyword list and correction history.
alter table inventory_items add column if not exists photo_sourcing_type text
  check (photo_sourcing_type in ('branded', 'generic'));
