-- 212_suppliers_bilingual_and_normalise.sql
-- SS-025. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- suppliers are PLACES; household_contacts are PEOPLE. Two tables, one
-- page, two sections -- deliberately not merged.

alter table public.suppliers
  add column if not exists name_es text,
  add column if not exists kind text,
  add column if not exists kind_es text,
  add column if not exists kosher_supervision text,
  add column if not exists delivers boolean,
  add column if not exists notes_es text,
  add column if not exists sort_order integer not null default 0;

-- Seven values, so the page's filter chips come straight off the column
-- rather than off a hardcoded list that can drift from the data.
alter table public.suppliers
  drop constraint if exists suppliers_kind_check;
alter table public.suppliers
  add constraint suppliers_kind_check
  check (kind is null or kind in ('grocery','kosher_grocery','warehouse','general_retail','delivery_service','specialty','other'));

comment on table public.suppliers is
  'SS-025. Where the house actually buys from. Distinct from household_contacts, which is people. Bilingual: name_es and notes_es because staff read Spanish.';
comment on column public.suppliers.kosher_supervision is
  'Free text hashgacha note. Kashrut questions go to Racquel or her Rav, never guessed here.';
