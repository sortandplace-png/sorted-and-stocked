-- 159_clone_repair_photos_and_locations.sql
-- SS-446 (photos) + SS-067 (locations), both GO by Racquel's 31 Jul
-- rulings. The 31 Jul bulk clone dropped photo_url entirely (Lax 0/946,
-- Country 397/946, Low 0/96) and left ~1,425 items location-less.
--
-- Both repairs map each clone item to ONE canonical Main namesake --
-- distinct on lower(trim(name)) -- because Main stocks the same product
-- in several rooms and a naive name join fans out (verified before
-- writing). Per field the canonical row is the first namesake that HAS
-- the field, ordered by id for determinism.
--
-- Photos: copy the Main namesake's photo_url where the clone's is null.
-- Dry-run matched 1,061 (Lax 728, Country 332, Low 1), exactly the
-- recoverable count in the SS-446 ruling. Only fills nulls; existing
-- photos are never overwritten (R21).
--
-- Locations: the approved mapping -- Main namesake's location NAME,
-- resolved against a same-named location in the clone's own property --
-- MATCHED 0 ROWS at apply time on all three properties: Lax and Low have
-- no rows in locations at all, and Country's 7 location names share only
-- one name with Main, which no matchable namesake uses. The statement is
-- kept because it is the approved repair and is exactly what should run
-- once those houses get location rows; today it is a no-op, and the
-- location-less items stay unmatched for manual pick per the ruling.

-- Photos (SS-446)
with main_photo as (
  select distinct on (lower(trim(i.name))) lower(trim(i.name)) as k, i.photo_url
  from inventory_items i join properties p on p.id = i.property_id
  where p.name = 'Main' and i.photo_url is not null
  order by lower(trim(i.name)), i.id
)
update inventory_items i
set photo_url = mp.photo_url
from properties p, main_photo mp
where p.id = i.property_id and p.name in ('Lax','Country','Low')
  and i.photo_url is null
  and mp.k = lower(trim(i.name));

-- Locations (SS-067) -- matched 0 at apply time, see header.
with main_loc as (
  select distinct on (lower(trim(i.name))) lower(trim(i.name)) as k, lower(trim(l.name)) as loc_k
  from inventory_items i
  join properties p on p.id = i.property_id
  join locations l on l.id = i.location_id
  where p.name = 'Main'
  order by lower(trim(i.name)), i.id
),
target_locs as (
  select distinct on (property_id, lower(trim(name))) property_id, lower(trim(name)) as k, id
  from locations
  order by property_id, lower(trim(name)), id
)
update inventory_items i
set location_id = tl.id
from properties p, main_loc ml, target_locs tl
where p.id = i.property_id and p.name in ('Lax','Country','Low')
  and i.location_id is null
  and ml.k = lower(trim(i.name))
  and tl.property_id = i.property_id and tl.k = ml.loc_k;
