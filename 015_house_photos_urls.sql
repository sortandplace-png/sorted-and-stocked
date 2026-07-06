-- ============================================================================
-- 015: Real House Photos found — one confirmed match, plus fixing the URL
-- format on the 19 items imported earlier with Drive links.
-- ============================================================================
-- Google Drive has TWO relevant URL shapes for a file:
--   .../file/d/{ID}/view       — a webpage, NOT embeddable as an <img> src
--   .../thumbnail?id={ID}      — CAN be hotlinked directly as an image
-- Everything imported earlier used the first (broken) format. This
-- converts all existing photo_url values on inventory_items to the second.

update public.inventory_items
set photo_url = 'https://drive.google.com/thumbnail?id=' ||
  substring(photo_url from 'file/d/([^/]+)') || '&sz=w500'
where photo_url like 'https://drive.google.com/file/d/%'
  and property_id = (select id from public.properties where name = 'Strauss' limit 1);

-- One confirmed real match found while searching the "House Photos" folder
-- tree: a photo literally named for this exact item.
update public.inventory_items
set photo_url = 'https://drive.google.com/thumbnail?id=1J1jFYYZKVeEeX-HI1JrxRnRpPj9I703f&sz=w500'
where name = 'Pas Yisroel Whole Wheat Pita 6 Pk'
  and property_id = (select id from public.properties where name = 'Strauss' limit 1);
