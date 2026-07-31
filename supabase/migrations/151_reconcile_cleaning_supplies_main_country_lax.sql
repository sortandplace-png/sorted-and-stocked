-- 151_reconcile_cleaning_supplies_main_country_lax.sql
-- Reconciles 99 inventory_items created live by direct SQL between 02:51
-- and 02:57 UTC 31 Jul, not a migration (same reasoning as 138/145/147):
-- the cleaning-supplies stock list, 33 items each on Main, Country and Lax.
--
-- Verified before writing: the 99 rows are exactly 33 distinct item specs
-- x 3 properties -- identical name/notes/links/kashrut per item, differing
-- only in id, property_id and qr_code. So the spec is written ONCE and the
-- per-property identity is a slim (id, property, qr_code) map, rather than
-- 99 near-duplicate full rows. Ids and QR codes are the live values, so
-- this replays faithfully and is a no-op against the current database.
--
-- KASHRUT COLOUR SYSTEM (Racquel, 30 Jul -- decisions, not defaults):
--   * Cloths and sponges carry designations: meat RED, dairy BLUE, pareve
--     GREEN. Pesach is marked by STICKER, not colour, and is stored away
--     outside Pesach. Buckets do NOT need colour coding.
--   * The Shabbos silicone sponge is a halachic requirement, not a
--     preference.
-- Do not rename, merge, or "deduplicate" the colour-coded variants.
--
-- All 99 rows: current_qty 0, supplier Amazon, pesach_status
-- not_applicable, print_label true, auto_restock_eligible true, no
-- location_id.

with spec (name, name_es, category, min_qty, unit, reorder_link, notes, kosher_type, internal_notes, updated_at) as (values
  ('Broom and Dustpan', 'Escoba y Recogedor', 'Household & Tools', '1', 'set', 'https://www.amazon.com/dp/B0BRK83JY7', 'SOP-046 entry sweep, SOP-084 basement steps.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Cedar Blocks and Moth Sachets', 'Bloques de Cedro y Sobres Antipolillas', 'Household & Tools', '1', 'pack', 'https://www.amazon.com/dp/B08LP2LPJ4', 'Coat closet and seasonal storage. Replace when the scent fades.', NULL, 'Racquel 30 Jul: the next step after velvet hangers and dust bags for the coat closet procedure.', '2026-07-31 02:53:48.105088+00'),
  ('Cleaning Buckets', 'Cubetas de Limpieza', 'Cleaners', '2', 'each', 'https://www.amazon.com/dp/B0C61G4QN7', 'General cleaning buckets.', NULL, 'Racquel 30 Jul: buckets do NOT need colour coding. Only cloths and sponges carry kashrus designations.', '2026-07-31 02:52:09.154684+00'),
  ('Cleaning Caddy', 'Caja Organizadora de Limpieza', 'Household & Tools', '2', 'each', 'https://www.amazon.com/dp/B0CGKXW96P', 'One caddy carried room to room instead of armfuls of bottles.', NULL, 'Racquel 30 Jul: "right now she has to carry armfuls."', '2026-07-31 02:56:47.233815+00'),
  ('Cleaning Cloths — DAIRY (Blue)', 'Paños de Limpieza — LÁCTEO (Azul)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B098DCRHXY', 'BLUE cloths. Dairy surfaces only. Never cross to meat.', 'dairy', 'Same colour set as meat/pareve.', '2026-07-31 02:52:09.154684+00'),
  ('Cleaning Cloths — MEAT (Red)', 'Paños de Limpieza — CARNE (Rojo)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B098DCRHXY', 'RED cloths. Meat surfaces only. Never cross to dairy.', 'meat', 'Colour set B098DCRHXY covers all designations in one purchase. Racquel 30 Jul: meat red, dairy blue, pareve green.', '2026-07-31 02:52:09.154684+00'),
  ('Cleaning Cloths — PAREVE (Green)', 'Paños de Limpieza — PARVE (Verde)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B098DCRHXY', 'GREEN cloths. Pareve surfaces.', 'parve', 'Same colour set.', '2026-07-31 02:52:09.154684+00'),
  ('Cleaning Cloths — PESACH', 'Paños de Limpieza — PÉSAJ', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B098DCRHXY', 'Pesach cloths. Marked with a kosher-for-Pesach sticker. Stored away when it is not Pesach.', NULL, 'Racquel 30 Jul: Pesach is identified by STICKER, not by colour, and is generally put away outside Pesach.', '2026-07-31 02:52:09.154684+00'),
  ('Command Hooks and Strips', 'Ganchos y Tiras Command', 'Household & Tools', '1', 'pack', 'https://www.amazon.com/dp/B07712H557', 'Damage-free hanging. Check weight rating before use.', NULL, 'Racquel supplied 30 Jul.', '2026-07-31 02:53:48.105088+00'),
  ('Fabuloso Multi-Purpose Cleaner', 'Limpiador Multiusos Fabuloso', 'Cleaners', '2', 'bottle', 'https://www.amazon.com/dp/B0FKD1WW8B', 'General floors. NOT the gym -- gym uses COREtec.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Floor Squeegee', 'Escurridor de Piso', 'Household & Tools', '1', 'each', 'https://www.amazon.com/dp/B0BZPHXL4D', 'Hard floors and basement.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Grout Brush', 'Cepillo para Juntas', 'Household & Tools', '1', 'each', 'https://www.amazon.com/dp/B0CKFGNR71', 'SOP-061, bathroom tile and grout.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Hand Soap Refill', 'Recarga de Jabón de Manos', 'Cleaners', '2', 'bottle', 'https://www.amazon.com/dp/B07QSCRBH6', 'Checked at every bathroom restock, SOP-056.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Leather Conditioner', 'Acondicionador de Cuero', 'Cleaners', '1', 'bottle', 'https://www.amazon.com/dp/B0DK7LQ9MR', 'SOP-018 leather furniture.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Microfiber Cloths', 'Paños de Microfibra', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B082XSJT1R', 'Named in 14 procedures. The most-used cleaning supply in the house.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Microfiber Mop Refill Pads', 'Repuestos de Microfibra para Trapeador', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B0G64FV3YQ', 'Refills for the flat mop.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Mop and Bucket', 'Trapeador y Cubeta', 'Household & Tools', '1', 'set', 'https://www.amazon.com/dp/B091F1RPHD', 'SOP-060 and SOP-013 floor work.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Mr. Clean Multi-Surface Floor Cleaner', 'Limpiador de Pisos Mr. Clean', 'Cleaners', '2', 'bottle', 'https://www.amazon.com/dp/B0GCCGWT11', 'General floors. NOT the gym.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Nitrile Disposable Gloves', 'Guantes Desechables de Nitrilo', 'Cleaners', '2', 'box', 'https://www.amazon.com/dp/B0FC4VNG4M', 'Single-use. For toilets, oven cleaner, silver polish and shaimos sorting. NOT the same as the reusable rubber gloves.', NULL, 'Racquel 30 Jul flagged these as distinct from the rubber gloves -- disposable for dirty or chemical jobs, reusable for wet work.', '2026-07-31 02:53:48.105088+00'),
  ('Rubber Gloves', 'Guantes de Goma', 'Cleaners', '2', 'pair', 'https://www.amazon.com/dp/B0BYJDCWP9', 'Worn for the Tineco tank rinse and all wet work.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Silver Cleaning Gloves', 'Guantes para Limpiar Plata', 'Cleaners', '1', 'pair', 'https://www.amazon.com/dp/B08TTVSTKX', 'Anti-tarnish polishing gloves. Wear while polishing kiddush cups, bechers and candlesticks.', NULL, 'Racquel supplied 30 Jul alongside the silver polish and cloths.', '2026-07-31 02:56:47.233815+00'),
  ('Silver Polish', 'Abrillantador de Plata', 'Cleaners', '1', 'each', 'https://www.amazon.com/dp/B001949QRY', 'Kiddush cups, bechers, candlesticks. Weekly before Shabbos.', NULL, 'Goddard''s Silver Polish with applicator. Racquel originally said Kosher West; she then supplied this Amazon product directly on 30 Jul, so Amazon stands unless she says otherwise.', '2026-07-31 02:56:47.233815+00'),
  ('Silver Polishing Cloth', 'Paño para Pulir Plata', 'Cleaners', '2', 'each', 'https://www.amazon.com/dp/B0786YX1BS', 'Used with silver polish. Kept separate from all other cloths.', NULL, 'Goddard''s silver polishing cloths. Racquel supplied 30 Jul.', '2026-07-31 02:56:47.233815+00'),
  ('Soft Dusting Brush', 'Cepillo Suave para Polvo', 'Household & Tools', '1', 'each', 'https://www.amazon.com/dp/B07YW8SCZ9', 'SOP-027 seforim. Soft bristles only.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Sponges — DAIRY (Blue)', 'Esponjas — LÁCTEO (Azul)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B0DN2448GQ', 'BLUE sponges. Dairy sink and dairy dishes only.', 'dairy', 'Scrub Mommy colour range.', '2026-07-31 02:52:09.154684+00'),
  ('Sponges — MEAT (Red)', 'Esponjas — CARNE (Rojo)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B0DN247QGZ', 'RED sponges. Meat sink and meat dishes only.', 'meat', 'Scrub Daddy colour range.', '2026-07-31 02:52:09.154684+00'),
  ('Sponges — PAREVE (Green)', 'Esponjas — PARVE (Verde)', 'Cleaners', '2', 'pack', 'https://www.amazon.com/dp/B0DN247QGZ', 'GREEN sponges. Pareve only.', 'parve', 'Same colour range.', '2026-07-31 02:52:09.154684+00'),
  ('Sponges — SHABBOS (Silicone)', 'Esponjas — SHABBOS (Silicona)', 'Cleaners', '1', 'pack', 'https://www.amazon.com/dp/B08NGBDR87', 'Silicone Shabbos sponge. Does not absorb, so it may be used on Shabbos.', NULL, 'Racquel supplied this one specifically -- it is a halachic requirement, not a preference.', '2026-07-31 02:52:09.154684+00'),
  ('Spray Bottles — Colour-Coded Set', 'Botellas Rociadoras — Juego por Color', 'Household & Tools', '1', 'set', 'https://www.amazon.com/dp/B0D14P72NH', 'Red meat, blue dairy, green pareve. Label every bottle with what is in it AND its designation.', NULL, 'RACQUEL 30 Jul, her own catch: vinegar, Fabuloso and alcohol were stocked with nothing to decant them into. Colour-coded bottles extend the meat/dairy/pareve system from cloths to the cleaners themselves.', '2026-07-31 02:56:47.233815+00'),
  ('Step Stool — Folding 2-Step', 'Banquito Plegable de 2 Escalones', 'Household & Tools', '1', 'each', 'https://www.amazon.com/dp/B0DP2CTQ7G', 'Required for high work. SOP-092 vent cover and SOP-094 shower head both instruct staff to use a stool rather than the tub edge.', NULL, 'Racquel supplied 30 Jul. NOTE: two procedures already instruct staff to use a step stool and none was in inventory -- a safety instruction with no equipment behind it.', '2026-07-31 02:53:48.105088+00'),
  ('Stiff Scrub Brush', 'Cepillo de Cerdas Duras', 'Household & Tools', '1', 'each', 'https://www.amazon.com/dp/B07YCYZQVJ', 'SOP-059 tub scrub and SOP-089 outdoor steps.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Toilet Paper', 'Papel Higiénico', 'Paper Goods', '3', 'pack', 'https://www.amazon.com/dp/B0CM4NXMV2', 'Checked at every bathroom restock, SOP-056.', NULL, NULL, '2026-07-31 02:51:48.507515+00'),
  ('Wood Floor Cleaner (Bona)', 'Limpiador para Pisos de Madera (Bona)', 'Cleaners', '1', 'bottle', 'https://www.amazon.com/dp/B000ARPVIY', 'Hardwood only.', NULL, NULL, '2026-07-31 02:51:48.507515+00')
),
rowmap (id, property_id, qr_code, name) as (values
  -- Main (ba9ed5a7)
  ('f98e483d-82ef-4b0d-acbf-83efd201cec4', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-CCDA1774', 'Broom and Dustpan'),
  ('11501981-1b4b-493d-ac35-db4c22ba818f', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-414AC654', 'Cedar Blocks and Moth Sachets'),
  ('353e9743-92e8-4abf-b1ea-af2bdb63839c', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-01125A06', 'Cleaning Buckets'),
  ('9c8ceae5-2cd9-4fd6-8409-0dd425e32f7b', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-2BCB28DE', 'Cleaning Caddy'),
  ('2a999d0b-11d9-466d-9765-6b663aef4c44', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-04336BBC', 'Cleaning Cloths — DAIRY (Blue)'),
  ('fe387449-0beb-45b9-bea2-484a3caf8808', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-217C2A14', 'Cleaning Cloths — MEAT (Red)'),
  ('c8fdee5e-66e7-4178-8ec9-a00634698a49', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-1DD93BCA', 'Cleaning Cloths — PAREVE (Green)'),
  ('7d62ab85-895c-429c-b6d1-82d539512f2e', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-A7BC7870', 'Cleaning Cloths — PESACH'),
  ('4ee4141c-d94e-4021-a396-30beed98a296', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-4A48EC63', 'Command Hooks and Strips'),
  ('04cd2c4d-1c29-4634-899c-ad06ba3b5bd0', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-F1794537', 'Fabuloso Multi-Purpose Cleaner'),
  ('7bd103c0-c5d1-4360-97ff-794f1d860c8b', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-85D3F74D', 'Floor Squeegee'),
  ('3a1a9c8b-6733-4359-bf87-d0304041b973', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-075F40C3', 'Grout Brush'),
  ('c93c5b38-698a-450a-8b6e-2526c3f933ad', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-33DB3415', 'Hand Soap Refill'),
  ('7f2d9b60-bd6e-46e5-8333-bb2047085f7a', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-8697422E', 'Leather Conditioner'),
  ('e306c418-fc47-4b3e-9df1-eee0c25d2d9a', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-1D548FE8', 'Microfiber Cloths'),
  ('f2a27ee7-c0e8-4035-8fee-c9e36e43231a', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-9671FB06', 'Microfiber Mop Refill Pads'),
  ('61ae7ab5-f462-4ec3-a1c1-e3bb62f389a0', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-93C419C3', 'Mop and Bucket'),
  ('e35aec02-71a4-4052-a3c8-a3d94edec4c1', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-42CE2051', 'Mr. Clean Multi-Surface Floor Cleaner'),
  ('2dc60940-25cf-4a6a-a7e9-1908b8703d02', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-5B728DF9', 'Nitrile Disposable Gloves'),
  ('84616d33-0b6d-487d-a792-369297fc071f', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-35481827', 'Rubber Gloves'),
  ('62654338-ab9d-43a6-8287-8b26e5a5f5ef', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-D7A8FD04', 'Silver Cleaning Gloves'),
  ('2e234b04-6183-4aeb-ac64-c379397d3b58', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-A41E0426', 'Silver Polish'),
  ('128833f6-5b80-43b0-b9ec-f888b9347814', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-08A2DEE2', 'Silver Polishing Cloth'),
  ('293966ab-7a57-4344-acad-be4387b3cd49', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-99E994C9', 'Soft Dusting Brush'),
  ('63de6886-68b3-4486-a788-e194914a156c', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-573CFF04', 'Sponges — DAIRY (Blue)'),
  ('43c19817-3536-4f07-8894-9161dfc6d289', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-F2042833', 'Sponges — MEAT (Red)'),
  ('4e716a19-32d5-4d14-a91d-1582f50fbfca', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-85B8E488', 'Sponges — PAREVE (Green)'),
  ('08615ea9-bcda-42f8-a5fb-79964f13dd6f', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-98BEF8DB', 'Sponges — SHABBOS (Silicone)'),
  ('18d723d3-5fed-4037-b46f-bc4935b4485a', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-48E456BF', 'Spray Bottles — Colour-Coded Set'),
  ('f608fec2-c016-4659-8738-d62453c39ce4', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-DCCB0B89', 'Step Stool — Folding 2-Step'),
  ('42dcbd4d-53de-42e2-9049-f46a3457664f', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-57B30324', 'Stiff Scrub Brush'),
  ('52f4e6fc-4520-47fb-b508-44873d06de0f', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-77104065', 'Toilet Paper'),
  ('4cf02554-404b-4f46-b161-c13d33da6c84', 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', 'ITM-AC56B572', 'Wood Floor Cleaner (Bona)'),
  -- Country (8abac96b)
  ('58edc8e3-5a2d-410b-9769-a7458762682d', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-0D37A7F7', 'Broom and Dustpan'),
  ('fc199a89-a90e-4e12-a06a-e29b7e04bd09', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-53FB027F', 'Cedar Blocks and Moth Sachets'),
  ('337be594-1033-4aa3-96c3-776ef23705b6', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-C30DECF7', 'Cleaning Buckets'),
  ('8562c7fb-4d23-495a-986d-05c8f2978191', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-E00A0B41', 'Cleaning Caddy'),
  ('7b5c4904-033f-4e9a-8c2e-ed50d2de07ae', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-562B06B5', 'Cleaning Cloths — DAIRY (Blue)'),
  ('3a56be33-7776-4a84-b853-da0095763d4f', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-CA59304A', 'Cleaning Cloths — MEAT (Red)'),
  ('78f2f428-c4a3-47fa-9c0b-5d13abf07a66', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-DDF65E7D', 'Cleaning Cloths — PAREVE (Green)'),
  ('7257643d-5ead-4c49-8706-40219b107b71', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-2E56312E', 'Cleaning Cloths — PESACH'),
  ('3d9d4b63-00cf-492b-a13f-09d45fec3fb2', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-1D9DC60D', 'Command Hooks and Strips'),
  ('31a0d415-256c-4e18-be19-ca6ff23e1c9c', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-4C3405CE', 'Fabuloso Multi-Purpose Cleaner'),
  ('2f13d913-9a34-4197-9f64-413cf22b3338', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-6A12FA3B', 'Floor Squeegee'),
  ('a31c654e-f084-4a6b-9cc4-2fab063384e1', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-FFD5FE60', 'Grout Brush'),
  ('5f7d0863-f781-48f2-8d3d-f9684d483d5d', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-9FD6EADF', 'Hand Soap Refill'),
  ('1df8a4ea-2a01-4448-8943-d5178d36638c', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-A47EEA71', 'Leather Conditioner'),
  ('4d4ac4de-ddcf-4c67-85ba-2b0b51d89a97', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-7B76152A', 'Microfiber Cloths'),
  ('19f18664-63b3-4f0f-af74-3d6793b2a7d8', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-90549326', 'Microfiber Mop Refill Pads'),
  ('38ba83fc-0ae8-40aa-b334-f98db81625ac', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-4A2E624D', 'Mop and Bucket'),
  ('56e07892-0bc0-4d0a-80ad-0b4faf44da4d', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-C973A929', 'Mr. Clean Multi-Surface Floor Cleaner'),
  ('d10f6713-a6a3-42d5-900c-0a2737f6abbd', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-635875E1', 'Nitrile Disposable Gloves'),
  ('5a667b20-dd6b-4d1d-adfb-9ead9a71009e', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-41C11304', 'Rubber Gloves'),
  ('a3e08800-6e17-43c3-8c1e-1e67c6e03450', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-EAFBD0B5', 'Silver Cleaning Gloves'),
  ('c78b5429-39bb-48b5-b5e9-ef80b8515515', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-77C6E406', 'Silver Polish'),
  ('5214fd22-db2f-445b-95a6-cb5a06d251d0', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-6B0361E1', 'Silver Polishing Cloth'),
  ('31e546da-ba80-4cd3-8b94-48b21e2ddac8', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-4B537F1C', 'Soft Dusting Brush'),
  ('2b4c07f2-bd62-4585-9ba7-1c6fda635fb7', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-2E569D6F', 'Sponges — DAIRY (Blue)'),
  ('61bbf0b1-8727-413b-8be6-03b152079478', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-B2A45DCE', 'Sponges — MEAT (Red)'),
  ('9d7211c8-dc8a-4518-a468-8e757bdd1867', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-22BFC84B', 'Sponges — PAREVE (Green)'),
  ('92b494fe-2b34-413a-8c65-420ef95b2970', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-C8AE4551', 'Sponges — SHABBOS (Silicone)'),
  ('a22dcb89-4ea3-4a64-acd9-5fb98a53a9bc', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-D66515AD', 'Spray Bottles — Colour-Coded Set'),
  ('594fc078-2917-49a7-87b8-14f028672924', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-A4704314', 'Step Stool — Folding 2-Step'),
  ('8419ed4c-ff42-495a-a240-8a29f20fe737', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-2B86F68B', 'Stiff Scrub Brush'),
  ('3d368d46-1d79-47dc-a7dc-e7e3f3e65a65', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-52BA8A2B', 'Toilet Paper'),
  ('f4f13082-46d2-4399-a340-be76ba15e0c2', '8abac96b-8a05-4f00-a762-8bc683d0091d', 'ITM-846E114C', 'Wood Floor Cleaner (Bona)'),
  -- Lax (a85471e6)
  ('3978c45d-a1cb-4a16-86db-0488ab68efc0', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-E0A4310D', 'Broom and Dustpan'),
  ('4e7abd15-2296-4fd5-ab46-4657009157d7', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-A6949E63', 'Cedar Blocks and Moth Sachets'),
  ('10a6d65a-081a-4a85-a30f-e340dc89c6dd', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-1E252289', 'Cleaning Buckets'),
  ('500054d5-f834-409e-9d19-3b63fde31344', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-6D6C1167', 'Cleaning Caddy'),
  ('b759e8ec-a1d1-406a-b9bf-907fb59c0cd1', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-EF2B13E5', 'Cleaning Cloths — DAIRY (Blue)'),
  ('92a7fd62-bed3-432e-9635-05131f681663', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-007DB574', 'Cleaning Cloths — MEAT (Red)'),
  ('4b43b308-ea4d-4e5f-add7-d5de2a00df78', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-81EEB36F', 'Cleaning Cloths — PAREVE (Green)'),
  ('fc147f45-25c8-447e-92c6-8a2a1a7a16fa', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-2B1C1822', 'Cleaning Cloths — PESACH'),
  ('fe072bd9-e2ef-495e-93b7-9782c5d17974', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-E466FF5B', 'Command Hooks and Strips'),
  ('034345e2-c926-4b39-853b-4704a88cdad3', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-3BA0382E', 'Fabuloso Multi-Purpose Cleaner'),
  ('4a89f2f5-c699-4e99-af3c-df78c1186f65', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-64BAC1F2', 'Floor Squeegee'),
  ('37de03ca-ae72-4ec6-b9d5-d46ed8a27a21', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-1388B517', 'Grout Brush'),
  ('9895a2e9-4225-44c6-9e79-f5fb6942d082', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-B0E91676', 'Hand Soap Refill'),
  ('b01d88c4-fff9-4d99-8005-dd4c97ab6412', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-E7399260', 'Leather Conditioner'),
  ('543c09c9-e2b6-4aa8-a07b-d47445d52665', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-031860D7', 'Microfiber Cloths'),
  ('2c2a5c8f-94fb-405e-85ff-e24b47a755c3', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-21E09D54', 'Microfiber Mop Refill Pads'),
  ('af9ba914-3e4f-4f0d-aa0e-d9a772bbe0a0', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-33C8D918', 'Mop and Bucket'),
  ('f54b0ec2-80e6-4454-9aa3-d9c630d03fc0', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-8890F3B1', 'Mr. Clean Multi-Surface Floor Cleaner'),
  ('4426cf02-d2dd-4aba-8934-dcaf8c5a17dc', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-3DC4D365', 'Nitrile Disposable Gloves'),
  ('a2739137-2f22-49f3-bd42-a88fc635cc63', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-8410D94C', 'Rubber Gloves'),
  ('7721d71a-6920-4059-9c03-c73c6b78510c', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-B1F79A03', 'Silver Cleaning Gloves'),
  ('a84f3eb5-e6ba-4456-99e5-bd61e0f6ee0f', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-053A7C12', 'Silver Polish'),
  ('22a7c8e7-c494-4b0c-8ab9-54adbce22ca7', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-26F8CBBD', 'Silver Polishing Cloth'),
  ('0b28dba3-22a2-43c2-89a0-92e0ef3cbd98', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-72DAF4C3', 'Soft Dusting Brush'),
  ('12324130-bc45-43c7-9bcb-e27f388a7272', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-55DF4DB9', 'Sponges — DAIRY (Blue)'),
  ('73fb055a-0b73-4883-84ba-6e1757af499b', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-1A0DD3B5', 'Sponges — MEAT (Red)'),
  ('89aeed81-c42d-4b23-a2d7-3ce526d06969', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-8D8C84C8', 'Sponges — PAREVE (Green)'),
  ('c1a10ea1-7c29-4265-979d-d4896da7b216', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-DABD16AB', 'Sponges — SHABBOS (Silicone)'),
  ('c725960d-275c-48f4-9ac5-0f136fdc0ee3', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-F9391732', 'Spray Bottles — Colour-Coded Set'),
  ('3351a909-a373-4b52-af13-04e52df08498', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-FFB19A9B', 'Step Stool — Folding 2-Step'),
  ('4af46afc-908b-47d2-a648-117aa76e5fb1', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-915022AE', 'Stiff Scrub Brush'),
  ('27696d1f-9d00-40b5-b798-727061489098', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-437F74B4', 'Toilet Paper'),
  ('598b2eee-9b09-4150-8ff1-686a6e4abd3b', 'a85471e6-30ee-46d5-838f-e83ed1dc9c16', 'ITM-3A92D319', 'Wood Floor Cleaner (Bona)')
)
insert into inventory_items (id, property_id, name, name_es, category, current_qty, min_qty, unit, qr_code, supplier, reorder_link, notes, kosher_type, pesach_status, internal_notes, print_label, auto_restock_eligible, updated_at)
select
  r.id::uuid,
  r.property_id::uuid,
  s.name,
  s.name_es,
  s.category,
  0,
  s.min_qty::numeric,
  s.unit,
  r.qr_code,
  'Amazon',
  s.reorder_link,
  s.notes,
  s.kosher_type,
  'not_applicable',
  s.internal_notes,
  true,
  true,
  s.updated_at::timestamptz
from rowmap r
join spec s using (name)
on conflict (id) do nothing;
