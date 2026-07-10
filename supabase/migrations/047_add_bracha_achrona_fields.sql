-- 047_add_bracha_achrona_fields.sql
-- Bracha achrona (after-blessing) companion to the existing bracha_category
-- (rishona) field, on both recipes and inventory_items -- brachos apply at
-- the ingredient/product level too, not just the recipe level.
alter table recipes
  add column if not exists bracha_achrona text,
  add column if not exists bracha_achrona_note text,
  add column if not exists bracha_needs_sourcing boolean not null default false;

alter table inventory_items
  add column if not exists bracha_achrona text,
  add column if not exists bracha_achrona_note text,
  add column if not exists bracha_needs_sourcing boolean not null default false;
