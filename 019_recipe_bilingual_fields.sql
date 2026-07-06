-- ============================================================================
-- 019: Real bilingual recipe fields
-- ============================================================================
-- The original recipe import folded Kosher_Type and Instructions_EN into a
-- single English-only `notes` string, and never stored Instructions_ES at
-- all -- meaning the Spanish half of every recipe's instructions was
-- silently dropped. This adds the real columns needed for an actual
-- bilingual recipe view, separate from freeform notes.

alter table public.recipes add column if not exists instructions_en text;
alter table public.recipes add column if not exists instructions_es text;
alter table public.recipes add column if not exists kosher_type text;
