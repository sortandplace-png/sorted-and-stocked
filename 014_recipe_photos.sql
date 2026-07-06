-- ============================================================================
-- 014: Recipe photos
-- ============================================================================
-- Recipes never had a photo field at all until now. Real photos do exist
-- for at least some recipes (found in the same Drive folders as the recipe
-- text), scattered and not yet fully catalogued.

alter table public.recipes
  add column if not exists photo_url text;

-- One confirmed real example: a real photo of "Eileen's Sweet and Tangy
-- Chicken" exists in Drive alongside its recipe text. Note: this is a
-- Google Drive "view" link, which — same limitation as inventory item
-- photos — won't render as a direct <img> without converting it to a
-- real hotlinkable image URL first. Recorded here so the link isn't lost,
-- not because it will display correctly as-is.
update public.recipes
set photo_url = 'https://drive.google.com/file/d/14oUdmqZWvwUBhDwt9XrP112Y7rCgx79E/view'
where name = 'Eileen''s Sweet & Tangy Chicken'
  and property_id = (select id from public.properties where name = 'Strauss' limit 1);
