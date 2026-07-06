-- ============================================================================
-- 008: Item metadata (photo, supplier, cost, reorder link)
-- ============================================================================
-- The original schema kept inventory_items intentionally lean. Bringing over
-- the full Master Inventory sheet (which has real product photos, suppliers,
-- prices, and reorder URLs) needs somewhere to put that data.

alter table public.inventory_items
  add column if not exists photo_url text,
  add column if not exists supplier text,
  add column if not exists unit_cost numeric,
  add column if not exists reorder_link text;

comment on column public.inventory_items.photo_url is 'Product photo URL, if known.';
comment on column public.inventory_items.supplier is 'Where this is normally sourced from (e.g. Kosher West, Amazon, Costco).';
comment on column public.inventory_items.unit_cost is 'Last known price, for reference only — not used in any calculation.';
comment on column public.inventory_items.reorder_link is 'Direct link to reorder this item, if one is known.';
