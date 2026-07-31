-- 162_training_videos_categories_posters.sql
-- SS-443 (R): Training Videos presentation. The page is 33 full-width
-- native <video> elements (7 app-training, 24 SOP demonstration clips,
-- 1 overview) with no posters -- a flat wall of black rectangles -- and
-- Racquel is about to add many more.
--
-- Schema part: organization + posters.
--   category_en / category_es -- bilingual section/filter labels, data not
--     code, so new categories arrive with new videos, no deploy needed.
--     Grouping key is category_en; category_es is display only (R19).
--   poster_path / poster_alt_en / poster_alt_es -- a storage path in the
--     SAME bucket as the video (signed alongside it; the buckets stay
--     private), with bilingual alt text. Nullable: the client renders a
--     branded facade when absent, so no poster never means a black box.
--     Any real poster imagery is subject to R18 review before upload.
--
-- Backfill maps every existing row into four categories by slug family.

alter table training_videos
  add column category_en text not null default 'General',
  add column category_es text not null default 'General',
  add column poster_path text,
  add column poster_alt_en text,
  add column poster_alt_es text;

comment on column training_videos.category_en is
  'SS-443: section/filter label (EN). Grouping key; category_es is the Spanish display label.';
comment on column training_videos.poster_path is
  'SS-443: storage path of the poster image in the SAME bucket as the video; signed together with it. Null = client renders its branded facade. Imagery is R18-gated.';

update training_videos set category_en = 'Getting Started',      category_es = 'Primeros Pasos'          where slug = 'sp-01-welcome';
update training_videos set category_en = 'Using the App',        category_es = 'Uso de la Aplicación'    where slug like 'sp-0%' and slug <> 'sp-01-welcome';
update training_videos set category_en = 'SOP Demonstrations',   category_es = 'Demostraciones de SOP'   where slug like 'sop-clip-%';
update training_videos set category_en = 'About Sorted & Stocked', category_es = 'Acerca de Sorted & Stocked' where slug = 'sp-promo';
