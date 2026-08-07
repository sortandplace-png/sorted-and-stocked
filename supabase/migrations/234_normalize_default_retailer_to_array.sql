-- 234_normalize_default_retailer_to_array.sql
-- Applied live 7 Aug 2026.
--
-- SS-463. properties.default_retailer was a scalar text column holding a
-- hand-rolled '+'-delimited compound value on Lax ('amazon+walmart'),
-- which is precisely what proved wrong downstream (SS-471): OrderLink
-- treated the whole compound string as "always show a Walmart pill",
-- inventing a fabricated search-URL secondary on every Lax item
-- regardless of whether that item has ever actually been sourced from
-- Walmart. Confirmed live/screenshot: 5 Basement Bath items, and 772 of
-- Lax's 946 items overall, carry zero Walmart sourcing yet rendered the
-- pill anyway. Main (single value 'amazon') and Henderson (single value
-- 'walmart') never showed this, which is what pointed at the delimiter
-- rather than the pill component.
--
-- The old CHECK constraint (properties_default_retailer_check, an =ANY
-- against three text literals) MUST be dropped BEFORE the column's type
-- changes: leaving it in place until after errored with "operator does
-- not exist: text[] = text", because ALTER COLUMN TYPE re-validates
-- every dependent constraint against the new type as part of the same
-- command, and a text-typed check has no way to evaluate against a
-- text[] column. Order matters here, confirmed by reproducing the error
-- in a rolled-back transaction before trusting the fix.
alter table properties drop constraint properties_default_retailer_check;
alter table properties alter column default_retailer drop default;
alter table properties alter column default_retailer type text[]
  using string_to_array(default_retailer, '+');
alter table properties alter column default_retailer set default array['amazon']::text[];
alter table properties add constraint properties_default_retailer_check
  check (default_retailer <@ array['amazon','walmart']::text[]
     and coalesce(array_length(default_retailer,1), 0) > 0);

comment on column properties.default_retailer is
  'SS-463/SS-448: which retailer(s) lead the cart action. Array of amazon|walmart, at least one. Amazon leads unless the array is walmart-only (Henderson). More than one entry no longer means "show a fabricated secondary pill everywhere" (that was the SS-471 bug) -- it only affects which URL the lead cart icon uses; real secondary pills come from an item''s own stored sources (SS-471 fix), never a synthesized search URL.';

-- property_templates.default_retailer -- same scalar shape, feeds new
-- properties created from a template (migration 200/201). Nullable, no
-- prior CHECK constraint to drop first.
alter table property_templates alter column default_retailer type text[]
  using case when default_retailer is null then null else string_to_array(default_retailer, '+') end;

comment on column property_templates.default_retailer is
  'SS-463: array of amazon|walmart, nullable. Seeds properties.default_retailer for a property created from this template.';
