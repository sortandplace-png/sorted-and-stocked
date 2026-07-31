-- 166_property_default_retailer.sql
-- SS-448 follow-on ruling (31 Jul): ordering defaults become per-property.
--   Henderson -> WALMART leads its order links.
--   Lax      -> Amazon-first stands, with Walmart offered alongside.
--   Everyone else -> Amazon-first (the SS-448 default), unchanged.
-- OrderLink resolves this via the property layout's context; the column is
-- the single source of truth.
alter table properties add column default_retailer text not null default 'amazon'
  check (default_retailer in ('amazon', 'walmart', 'amazon+walmart'));

comment on column properties.default_retailer is
  'SS-448: which retailer leads the cart action. amazon | walmart | amazon+walmart (amazon leads, walmart offered as a standing secondary).';

update properties set default_retailer = 'walmart' where name = 'Henderson';
update properties set default_retailer = 'amazon+walmart' where name = 'Lax';
