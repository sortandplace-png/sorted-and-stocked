-- 203_content_prompts_caption_and_asset.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.

alter table public.content_prompts
  add column if not exists asset_file text,
  add column if not exists caption_en text,
  add column if not exists caption_es text,
  add column if not exists anchor text;

comment on column public.content_prompts.anchor is
  'Where in the post the image goes, as written in the plan, e.g. "after H2 1".';
comment on column public.content_prompts.asset_file is
  'Filename only. Resolution to a served path is Code''s: published images are served from /public/images/, not Supabase storage.';
