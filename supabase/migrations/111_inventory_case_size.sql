-- 111_inventory_case_size.sql
-- No existing field identified this as a case-good item -- confirmed via
-- schema check, not assumed. Nullable: most items aren't bought by the
-- case, and null means the new quantity-stepper's long-press bulk-add
-- stays off for that item rather than guessing a default. Populated
-- per-item through the inventory edit form, not backfilled here --
-- there's no reliable signal in existing data to infer it from.
alter table inventory_items
  add column if not exists case_size integer null;

alter table inventory_items
  add constraint inventory_items_case_size_positive check (case_size is null or case_size > 0);
