-- ============================================================================
-- 035: Print Label toggle on inventory items
-- ============================================================================
-- Backs the new "Print Label" toggle in the redesigned Edit Item modal.
-- Defaults true so existing Print Labels page behavior (everything
-- pre-selected) is unchanged for items created before this migration.

alter table public.inventory_items
  add column if not exists print_label boolean not null default true;

comment on column public.inventory_items.print_label is
  'Whether this item should be pre-selected on the Print Labels page. Defaults true so existing behavior (everything selected) is unchanged; the Edit Item modal exposes this as a toggle.';
