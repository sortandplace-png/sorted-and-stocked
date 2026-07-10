-- 045_backfill_photos_reorder_links_batch1.sql
-- First real batch against the 302 inventory_items missing both photo_url
-- and reorder_link, prioritizing Pantry (24) and Produce (29) per the
-- session's priority zones. Of those 53, only 3 had a specific enough
-- brand in their name to responsibly match against Open Food Facts
-- (a branded-packaged-goods database) -- the other 50 are generic
-- unbranded items (Peanut Butter, Onions, Cucumber, etc.) where forcing
-- an OFF match would risk a wrong product; left alone rather than
-- guessed. See session report for the full flagged list.
update inventory_items set photo_url = 'https://images.openfoodfacts.org/images/products/007/341/604/0489/front_en.10.400.jpg'
  where id = '3eda031b-3ae5-44e3-96b1-82dfcc48f65b'; -- Lundberg Organic Jasmine Rice 32oz
update inventory_items set photo_url = 'https://images.openfoodfacts.org/images/products/007/143/000/0212/front_en.3.400.jpg'
  where id = 'dcb5feb4-3ef9-4773-8f90-d1e53c38c2d4'; -- Dole Carrots Cello California 16 Oz
update inventory_items set photo_url = 'https://images.openfoodfacts.org/images/products/005/260/075/1219/front_de.65.400.jpg'
  where id = 'f3acbdc1-837e-412f-ad8a-be1e00c9841e'; -- Marshmallow Fluff

-- Reorder links: real, verified Amazon product pages found via web search.
-- Dole Carrots got a photo but no reorder_link -- no exact-brand match
-- was found (search only surfaced generic "cello carrots", not confirmed
-- Dole-branded), left null rather than guessed.
update inventory_items set reorder_link = 'https://www.amazon.com/Lundberg-Organic-Rice-Jasmine-White/dp/B00MN32BYA'
  where id = '3eda031b-3ae5-44e3-96b1-82dfcc48f65b';
update inventory_items set reorder_link = 'https://www.amazon.com/Marshmallow-Fluff-Original-16-Ounce/dp/B00HPWJHSW'
  where id = 'f3acbdc1-837e-412f-ad8a-be1e00c9841e';
