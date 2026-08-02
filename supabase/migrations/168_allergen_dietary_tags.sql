-- 168_allergen_dietary_tags.sql
-- Observance gating amendment (31 Jul 2026): Allergen Verification and
-- Dietary Tagging are UNIVERSAL tools -- every property, always on --
-- not swap-replacements for the Jewish-only Hechsher Verification /
-- Kosher Type Tagging pair (which they sit alongside, not instead of).
-- These two columns are their backing data, additive only (R21).
--
-- Same NULL convention as hechsher (see HechsherVerificationClient):
-- NULL means "never reviewed"; a non-NULL empty array is a real reviewed
-- decision ("checked, none apply"), so the worklists can distinguish an
-- unreviewed gap from a reviewed all-clear.
alter table inventory_items add column allergens text[];
alter table inventory_items add column dietary_tags text[];

comment on column inventory_items.allergens is
  'Reviewed allergen list (FDA big-9 vocabulary: Milk, Eggs, Fish, Shellfish, Tree Nuts, Peanuts, Wheat, Soy, Sesame). NULL = unreviewed; empty array = reviewed, none apply. Universal (all properties), per the observance gating amendment.';
comment on column inventory_items.dietary_tags is
  'Reviewed dietary tags (Vegan, Vegetarian, Gluten-Free, Dairy-Free, Nut-Free). NULL = unreviewed; empty array = reviewed, none apply. Universal (all properties), per the observance gating amendment.';
