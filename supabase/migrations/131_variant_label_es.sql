-- 131_variant_label_es.sql
--
-- !! NOT YET APPLIED -- FOR REVIEW. !!
--
-- Closes a real gap in migration 125: master_products got name_es, but
-- inventory_items.variant_label shipped with NO Spanish sibling. variant_label
-- is user-facing -- it is the text in the variety dropdown ("7 inch",
-- "Ataulfo", "4 Gallon") -- so an English-only variant label is exactly the
-- state the bilingual rule exists to prevent, and staff would be picking
-- between options they cannot read.
--
-- Deliberately NOT enforced by trg_require_spanish. That trigger hard-raises
-- on inventory_items.name_es, and rightly so: every item has a name. But
-- variant_label is NULL for every ungrouped item (currently all 1,581 of
-- them), and ungrouped is the permanent normal state. A NOT NULL or a raising
-- trigger here would break every ordinary insert. The pairing is enforced
-- instead by a CHECK: if a row has a variant label, it must have both
-- languages; if it has neither, that is fine.

alter table inventory_items
  add column if not exists variant_label_es text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_items_variant_label_bilingual_check'
  ) then
    alter table inventory_items add constraint inventory_items_variant_label_bilingual_check
      check (
        (variant_label is null and variant_label_es is null)
        or (btrim(coalesce(variant_label, '')) <> '' and btrim(coalesce(variant_label_es, '')) <> '')
      );
  end if;
end $$;

comment on column inventory_items.variant_label is
  'Short label distinguishing this row from its siblings under the same master_product_id ("7 inch", "Ataulfo", "4 Gallon"). NULL for ungrouped items, which is the normal state. Paired with variant_label_es by CHECK constraint.';
comment on column inventory_items.variant_label_es is
  'Spanish sibling of variant_label. Required whenever variant_label is set -- staff read the variety dropdown in Spanish.';
