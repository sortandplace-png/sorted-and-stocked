-- 217_document_suppliers_table_undocumented_origin.sql
-- SS-786. Applied live 6 Aug 2026. Documentation only, no schema change.
--
-- 212_suppliers_bilingual_and_normalise is the only migration in this
-- project's entire history whose name mentions "suppliers" -- confirmed
-- by searching supabase_migrations.schema_migrations for both '212%' and
-- '%supplier%' and getting the same single row back. 212 only ever ran
-- ALTER TABLE against a table that already existed WITH DATA: its
-- original columns (id, property_id, name, website, phone, notes, active,
-- created_at) and its original ~40-row seed have no migration record
-- anywhere, and neither does the later, separate growth to 60+ rows.
--
-- This is not fabricated as a CREATE TABLE / INSERT "baseline" -- doing
-- that would misrepresent history by claiming a reconstruction of DDL
-- and seed data nobody actually witnessed. The honest record is simply
-- that the origin is unknown and predates migration tracking for this
-- table.
comment on table public.suppliers is
  'SS-025/SS-786. Where the house actually buys from. Distinct from household_contacts, which is people. Bilingual: name_es and notes_es because staff read Spanish. ORIGIN UNDOCUMENTED: this table''s creation and its original seed rows have no migration record. 212_suppliers_bilingual_and_normalise (2026-08-06) is the earliest migration touching this table, and it only ALTERs a table that already existed with data -- it is not the origin. Row count has also grown at least once (40 to 60+) with no migration record for that growth either. Do not treat any single migration as this table''s baseline; there isn''t one.';
