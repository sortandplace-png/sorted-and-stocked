-- 161_master_products_global_catalog.sql
-- SS-406 (P), schema half only -- the variant DATA population is listed
-- for Racquel's review in tonight's report and is deliberately NOT here.
--
-- master_products.property_id was NOT NULL, which makes cross-property
-- identity inexpressible: "Windex" on Lax and "Windex" on Main could only
-- ever be two unrelated rows (lib/cross-house-inventory.ts documents this
-- as the reason productKey() still groups on normalised name). The
-- grouping UI (partitionByProduct, GroupedProductCard,
-- inventory_items.master_product_id / variant_label) is fully built and
-- waiting on rows here -- the table has been empty since it was created.
--
-- Change: property_id becomes nullable. NULL = a global catalog product,
-- shared by every house; a non-null property_id still means a
-- property-scoped product, so nothing existing (there is nothing
-- existing) or future per-house usage breaks. Each namespace gets its own
-- duplicate guard.

alter table master_products alter column property_id drop not null;

comment on column master_products.property_id is
  'NULL = global catalog product shared across all properties (SS-406); non-null scopes the product to one property. The cross-house console groups by master_product_id once populated.';

create unique index master_products_global_name_key
  on master_products (lower(name)) where property_id is null;

create unique index master_products_property_name_key
  on master_products (property_id, lower(name)) where property_id is not null;
