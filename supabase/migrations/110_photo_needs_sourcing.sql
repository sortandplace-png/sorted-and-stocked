-- 110_photo_needs_sourcing.sql
-- Same pattern as bracha_needs_sourcing (049): a plain flag for "a person
-- needs to resolve this, not code" -- here, items where a stock-photo
-- search turned up nothing trustworthy (ambiguous/generic name, no-brand
-- item, or a name/count combo that doesn't match a real current product)
-- and the right fix is a staff member photographing the actual item on
-- the shelf, not a closer web search. Reusable across every future batch
-- of the ongoing photo-backlog pass, not just tonight's 10.
alter table inventory_items
  add column if not exists photo_needs_sourcing boolean not null default false;
