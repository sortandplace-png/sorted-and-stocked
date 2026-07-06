-- ============================================================================
-- 018: FULL inventory replacement from Strauss_MASTER_Inventory_FINAL
-- ============================================================================
-- This is the real, correct, most current source -- three versions newer
-- (v9, v11, FINAL) than the v8 sheet originally imported, all sitting in the
-- main project folder and missed entirely. FINAL already cross-references a
-- real 'Grocery Order History Summary' doc, adding ~35 real items (some with
-- real confirmed photos: baking soda, Band-Aid, Canada Dry, Coke Zero,
-- Sprite) that were never carried into this app. Replaces the earlier
-- 154-item import with the full, correct 185-item set.
-- ============================================================================

delete from public.inventory_items
where property_id = (select id from public.properties where name = 'Strauss' limit 1);

do $$
declare
  v_property_id uuid := (select id from public.properties where name = 'Strauss' limit 1);
  v_location_id uuid;
begin
  -- BBED-019: Bobby Pins (assorted)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Bobby Pins (assorted)', 'Hair Accessories', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-020: Hair Elastics / Ties
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Hair Elastics / Ties', 'Hair Accessories', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-001: Pantene Pro-V Daily Moisture Renewal Conditioner (travel)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pantene Pro-V Daily Moisture Renewal Conditioner (travel)', 'Hair Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-011: Saltair Santal Bloom Conditioner (pump)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Shower niche';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Shower niche') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Saltair Santal Bloom Conditioner (pump)', 'Shower Dispenser', 'Amazon', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- BBED-010: Saltair Santal Bloom Hydrating Shampoo (pump)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Shower niche';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Shower niche') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Saltair Santal Bloom Hydrating Shampoo (pump)', 'Shower Dispenser', 'Amazon', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- BBED-027: Wet Brush Original Detangler
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Wet Brush Original Detangler', 'Accessory (durable)', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-008: Aquaphor Healing Ointment Advanced Therapy (travel tube)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Aquaphor Healing Ointment Advanced Therapy (travel tube)', 'Skin / First Aid', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-021: BIC Silky Touch Women's Disposable Razors
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'BIC Silky Touch Women''s Disposable Razors', 'Shaving', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-022: Dove Antiperspirant Deodorant (travel)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dove Antiperspirant Deodorant (travel)', 'Body Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-002: Dove Deep Moisture Body Wash (travel)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dove Deep Moisture Body Wash (travel)', 'Body Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-003: Dove Men+Care Clean Comfort Dry Spray Antiperspirant
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dove Men+Care Clean Comfort Dry Spray Antiperspirant', 'Body Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-033: Neutrogena Makeup Remover Cleansing Towelettes
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Neutrogena Makeup Remover Cleansing Towelettes', 'Skin Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-023: Purell Advanced Hand Sanitizer (travel)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Purell Advanced Hand Sanitizer (travel)', 'Hand Sanitizer', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-012: Saltair Santal Bloom Body Wash (pump)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Shower niche';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Shower niche') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Saltair Santal Bloom Body Wash (pump)', 'Shower Dispenser', 'Amazon', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- BBED-004: Crest Scope Classic Mouthwash (travel)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Crest Scope Classic Mouthwash (travel)', 'Oral Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-025: Dental Flossers (individually wrapped)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dental Flossers (individually wrapped)', 'Oral Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-006: Disposable Toothbrush + Toothpaste Kit (individually wrapped)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Disposable Toothbrush + Toothpaste Kit (individually wrapped)', 'Oral Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-005: Listerine Cool Mint PocketPaks Breath Strips (24 ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Listerine Cool Mint PocketPaks Breath Strips (24 ct)', 'Oral Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-015: Advil Ibuprofen 200 mg Tablets (travel vial)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Advil Ibuprofen 200 mg Tablets (travel vial)', 'OTC Medicine', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-032: Contact Lens Case
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Contact Lens Case', 'Eye / Lens Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-007: Opti-Free Replenish Disinfecting Solution
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Opti-Free Replenish Disinfecting Solution', 'Eye / Lens Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-016: TUMS Smoothies Extra Strength 750 Assorted Fruit (12 ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'TUMS Smoothies Extra Strength 750 Assorted Fruit (12 ct)', 'OTC Medicine', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-014: Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct)', 'OTC Medicine', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-018: Cotton Balls / Rounds
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Cotton Balls / Rounds', 'Cotton & Swabs', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-017: Cotton Swabs / Q-tips
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Cotton Swabs / Q-tips', 'Cotton & Swabs', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-009: Eishes Chayil Bedika Cloths (48 ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Eishes Chayil Bedika Cloths (48 ct)', 'Personal / Ritual', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-031: Pads (Always Radiant)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pads (Always Radiant)', 'Feminine Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-024: Tampons (Tampax Radiant)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tampons (Tampax Radiant)', 'Feminine Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-026: Facial Tissues (Kleenex)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Facial Tissues (Kleenex)', 'Paper Goods', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-034: Senteurs d'Orient Fleurs d'Oasis Hand Cream (La Crème)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Senteurs d''Orient Fleurs d''Oasis Hand Cream (La Crème)', 'Hand Care', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BBED-013: Senteurs d'Orient Fleurs d'Oasis Hand Wash (Le Lavabo)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Senteurs d''Orient Fleurs d''Oasis Hand Wash (Le Lavabo)', 'Hand Soap', 'Amazon', null, null, 'Supplier confirmed as Amazon by Racquel 7/2');

  -- BCOM-002: Nescafé Tasters Choice Decaf Instant Coffee Sticks
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Nescafé Tasters Choice Decaf Instant Coffee Sticks', 'Coffee', 'Amazon', 10.48, null, 'Priced as 105-cup jar from sourcing catalog - confirm matches actual stick pack size');

  -- BCOM-001: Nescafé Tasters Choice House Blend Instant Coffee Sticks
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Nescafé Tasters Choice House Blend Instant Coffee Sticks', 'Coffee', 'Kosher West', null, null, 'Supplier sourced from Household Sourcing Catalog');

  -- BCOM-003: Twinings Peppermint Herbal Tea
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Twinings Peppermint Herbal Tea', 'Tea', '', null, null, '');

  -- BCOM-005: Domino Sugar Packets
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Domino Sugar Packets', 'Sweetener', '', null, null, '');

  -- BCOM-008: Equal (Sweetener)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Equal (Sweetener)', 'Sweetener', '', null, null, '');

  -- BCOM-006: Raw / Turbinado Sugar Packets
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Raw / Turbinado Sugar Packets', 'Sweetener', '', null, null, '');

  -- BCOM-007: Splenda (No-Calorie Sweetener)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Splenda (No-Calorie Sweetener)', 'Sweetener', '', null, null, '');

  -- BCOM-009: Crystal Light Lemonade Drink Mix (packets)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Crystal Light Lemonade Drink Mix (packets)', 'Drink Mix', '', null, null, '');

  -- BCOM-020: Poland Spring Bottled Water (0.5 L)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poland Spring Bottled Water (0.5 L)', 'Bottled Water', 'BJ''s Wholesale', null, null, 'Corrected from real order history (BJ''s, delivered Jun 18 & 24) - supersedes earlier catalog-based guess');

  -- BCOM-018: Polar Seltzer — Black Cherry
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer — Black Cherry', 'Canned Beverage', '', null, null, '');

  -- BCOM-016: Polar Seltzer — Lemon
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer — Lemon', 'Canned Beverage', '', null, null, '');

  -- BCOM-015: Polar Seltzer — Lime
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer — Lime', 'Canned Beverage', '', null, null, '');

  -- BCOM-019: Polar Seltzer — Original (Regular)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer — Original (Regular)', 'Canned Beverage', '', null, null, '');

  -- BCOM-017: Polar Seltzer — Raspberry Lime
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer — Raspberry Lime', 'Canned Beverage', '', null, null, '');

  -- BCOM-013: Dixie Hot Cups + Lids
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dixie Hot Cups + Lids', 'Disposables', '', null, null, '');

  -- BCOM-021: Iced Coffee / Smoothie Cups + Lids
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Iced Coffee / Smoothie Cups + Lids', 'Disposables', '', null, null, '');

  -- BCOM-010: Plastic Coffee Stirrers
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Plastic Coffee Stirrers', 'Disposables', '', null, null, '');

  -- BCOM-011: Plastic Forks
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Plastic Forks', 'Disposables', '', null, null, '');

  -- BCOM-012: Plastic Spoons
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Plastic Spoons', 'Disposables', '', null, null, '');

  -- GYM-001: Poland Spring Bottled Water (0.5 L)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Supply cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Supply cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poland Spring Bottled Water (0.5 L)', 'Bottled Water', 'BJ''s Wholesale', null, null, 'Corrected from real order history (BJ''s, delivered Jun 18 & 24) - supersedes earlier catalog-based guess');

  -- GYM-004: COREtec 'The Original' ENCORE LVT Floor Cleaner (1 gal)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Supply cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Supply cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'COREtec ''The Original'' ENCORE LVT Floor Cleaner (1 gal)', 'Cleaning Supplies', '', null, null, '');

  -- GYM-002: Facial Tissues (Kleenex)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Supply cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Supply cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Facial Tissues (Kleenex)', 'Paper Goods', '', null, null, '');

  -- GYM-003: Purell Advanced Hand Sanitizer (single-use packets 125 ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Supply cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Supply cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Purell Advanced Hand Sanitizer (single-use packets 125 ct)', 'Cleaning', '', null, null, '');

  -- CLN-001: Lysol All-Purpose Cleaner — Lemon Breeze
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lysol All-Purpose Cleaner — Lemon Breeze', 'All-Purpose', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-002: Lysol Power Clinging Gel Toilet Bowl Cleaner
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lysol Power Clinging Gel Toilet Bowl Cleaner', 'Toilet Care', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-003: Murphy Oil Soap Wood Cleaner (concentrated)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Murphy Oil Soap Wood Cleaner (concentrated)', 'Wood / Floor Care', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-004: Lysol Power Clean 2X Multi-Surface Cleaner
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lysol Power Clean 2X Multi-Surface Cleaner', 'Multi-Surface', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-005: Owell Nitrile Gloves — Black Powder-Free (M 100)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Owell Nitrile Gloves — Black Powder-Free (M 100)', 'PPE / Gloves', 'Amazon', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-006: Resolve Stain Remover Carpet Cleaner (PRO)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Resolve Stain Remover Carpet Cleaner (PRO)', 'Carpet / Upholstery', '', null, null, '');

  -- CLN-007: Clorox Plus Tilex Daily Shower Cleaner
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Clorox Plus Tilex Daily Shower Cleaner', 'Shower Care', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-008: Windex Glass & More Multi-Surface Spray
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Windex Glass & More Multi-Surface Spray', 'Glass Care', '', null, null, '');

  -- CLN-009: Windex Commercial Line Original — Refill
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Windex Commercial Line Original — Refill', 'Glass Care · Refill', '', null, null, '');

  -- CLN-010: Soft Scrub All-Purpose Cleanser — Lemon
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Soft Scrub All-Purpose Cleanser — Lemon', 'Abrasive / All-Purpose', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- CLN-011: Mr. Clean Magic Eraser — Original (6 pk)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Mr. Clean Magic Eraser — Original (6 pk)', 'Scrub Pads', '', null, null, '');

  -- SUP-001: Avery 94219 Durable White Film Labels (1.5×1 32/sheet)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Office / Supply';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Office / Supply') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Avery 94219 Durable White Film Labels (1.5×1 32/sheet)', 'Label Stock', '', null, null, '');

  -- LDY-001: Dreft Stage 1: Newborn Liquid Detergent (32 loads)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dreft Stage 1: Newborn Liquid Detergent (32 loads)', 'Baby Detergent', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- LDY-002: Mama Bear Gentle Baby Wipes — Fragrance-Free
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Mama Bear Gentle Baby Wipes — Fragrance-Free', 'Baby Wipes', 'Amazon', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- LDY-003: OxiClean Max Force Laundry Stain Remover
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'OxiClean Max Force Laundry Stain Remover', 'Stain Remover', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- LDY-004: Shout Triple Acting Laundry Stain Remover
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Shout Triple Acting Laundry Stain Remover', 'Stain Remover', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- LDY-005: Downy Wrinkle Releaser + Crisp Linen Fabric Spray
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Downy Wrinkle Releaser + Crisp Linen Fabric Spray', 'Fabric Care', 'Costco', null, null, 'Par/Min sourced from Estate Procurement Sheet');

  -- KIT-001: Heinz Tomato Ketchup
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Heinz Tomato Ketchup', 'Condiment', 'Amazon', 3.5, 'https://drive.google.com/thumbnail?id=1OAxYEcZ5wamVBEt6qLnXJ7mEc3b1R37P&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Heinz');

  -- KIT-002: Sweet Baby Ray's Barbecue Sauce
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sweet Baby Ray''s Barbecue Sauce', 'BBQ Sauce', 'Amazon', 4.25, 'https://drive.google.com/thumbnail?id=1JzYCtG6hfFfRjOoNzob5JAOLbHXvYh3C&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Sweet Baby Ray''s');

  -- KIT-003: Frank's RedHot Original Hot Sauce
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Frank''s RedHot Original Hot Sauce', 'Hot Sauce', 'Amazon', 2.99, 'https://drive.google.com/thumbnail?id=1OvfTxuK6EtXbl93i10cYdqO9JqDh_6Ln&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Frank''s RedHot');

  -- KIT-004: Grey Poupon Dijon Mustard
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Grey Poupon Dijon Mustard', 'Mustard', 'Amazon', 3.5, 'https://drive.google.com/thumbnail?id=1cr3Tdt6O91QEu_jbz3t3KMUMr_5n_uDW&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Grey Poupon');

  -- KIT-005: Gold's Duck Sauce
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gold''s Duck Sauce', 'Condiment', 'Amazon', 2.5, 'https://drive.google.com/thumbnail?id=1IdR3kGm88wrh0r61GmbAGdCwj0zQn96i&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Gold''s');

  -- KIT-006: Lieber's Sriracha
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lieber''s Sriracha', 'Hot Sauce', 'Amazon', 4.99, 'https://drive.google.com/thumbnail?id=1x8SDJNG99X7cj0LIFVhL2Eiv5kHtBo-v&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Lieber''s Sriracha');

  -- KIT-007: Tuscanini Balsamic Glaze
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tuscanini Balsamic Glaze', 'Vinegar Glaze', 'Amazon', 7.5, 'https://drive.google.com/thumbnail?id=1UbBF11euyrGR185mygmNReYnxp9iMOxK&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Tuscanini Balsamic');

  -- KIT-008: Kedem White Wine Vinegar
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Kedem White Wine Vinegar', 'Vinegar', 'Kosher West', 3.99, 'https://drive.google.com/thumbnail?id=1590JDyGBC3ItspXRPIUSMBHxyHwxqWnr&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Kedem Vinegar');

  -- KIT-009: Achva Sesame Tahini
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Achva Sesame Tahini', 'Spread', 'Amazon', 6.5, 'https://drive.google.com/thumbnail?id=1p8XhwgAdFALlIQzrBbYLSsyCzQawPdka&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Achva');

  -- KIT-010: Haolam Grated Parmesan Cheese
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Haolam Grated Parmesan Cheese', 'Cheese', 'Kosher West', 4.5, 'https://drive.google.com/thumbnail?id=1vt0m2E9RVl4a_g1QkJNklC6Fjugv86FU&sz=w500', 'Refrigerate after opening \');

  -- KIT-011: Dagim Chunk Light Tuna in Water
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dagim Chunk Light Tuna in Water', 'Canned Fish', 'Kosher West', 2.25, 'https://drive.google.com/thumbnail?id=1gzZQbDK38tGShJ18YD_JW-5aA-OlzwIz&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Dagim');

  -- KIT-012: Tuscanini Tomato Paste
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tuscanini Tomato Paste', 'Canned', 'Amazon', 1.99, 'https://drive.google.com/thumbnail?id=1LTg4PmBPizZ9lHQIuWDorNMNQY_kE8Jd&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Tuscanini Paste');

  -- KIT-013: Gefen Cucumbers in Brine (Pickles)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gefen Cucumbers in Brine (Pickles)', 'Pickles', 'Kosher West', 3.5, 'https://drive.google.com/thumbnail?id=1QlnccE8FV3tF6Ug6yciNuNeYoRPY51RS&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Gefen Pickles');

  -- KIT-014: Onions (Tri-Color)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Onions (Tri-Color)', 'Produce', 'Kosher West', 2, 'https://drive.google.com/thumbnail?id=1TBGOEKHTpALZfXo54a8NjQZCND-hqy8c&sz=w500', 'Confirm storage \');

  -- KIT-015: Argo Corn Starch
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Argo Corn Starch', 'Baking', 'Amazon', 2.5, 'https://drive.google.com/thumbnail?id=19-mgWf3snt5zPrvaidw-ktwgIG9V0yCq&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Argo');

  -- KIT-016: Kellogg's Corn Flake Crumbs
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Kellogg''s Corn Flake Crumbs', 'Coating', 'Amazon', 4, 'https://drive.google.com/thumbnail?id=1EocYP3ICgSavhCtGLiWyE4fa2JzHMHzk&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Kellogg''s Corn Flake Crumbs');

  -- KIT-017: Ronzoni Elbows (Macaroni)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Ronzoni Elbows (Macaroni)', 'Pasta', 'Amazon', 1.5, 'https://drive.google.com/thumbnail?id=14iH6Ir155RRWUqVbmHKW3UZugVkD8Zkz&sz=w500', 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Ronzoni');

  -- KIT-018: Haddar Italian Dressing & Seasoning Mix
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Haddar Italian Dressing & Seasoning Mix', 'Dressing Mix', 'Kosher West', 1.99, null, 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Haddar');

  -- KIT-019: Ortega Grande Taco Kit
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Ortega Grande Taco Kit', 'Meal Kit', 'Amazon', 3.5, null, 'Real photo confirmed via contact sheet shared 7/2 - individual Drive link pending, brand match verified: Ortega');

  -- KIT-020: Pas Yisroel Whole Wheat Pita 6 Pk
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pas Yisroel Whole Wheat Pita 6 Pk', 'Bread', 'Kosher West', 3.99, null, '');

  -- KIT-021: Plastico Plates 7 in
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Plastico Plates 7 in', 'Disposable', 'Kosher West', 2.99, null, '');

  -- KIT-022: Dole Carrots Cello California 16 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dole Carrots Cello California 16 Oz', 'Produce', 'Kosher West', 1.19, null, '');

  -- KIT-023: Gefen Cholent Mix Chulent 16 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gefen Cholent Mix Chulent 16 Oz', 'Spice Mix', 'Kosher West', 2.29, null, '');

  -- KIT-024: Bean Broccoli Florets 24 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Bean Broccoli Florets 24 Oz', 'Frozen Vegetables', 'Kosher West', 3.49, null, '');

  -- KIT-025: Poskesz Rice Cake Minis Plain Box 4 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poskesz Rice Cake Minis Plain Box 4 Oz', 'Crackers', 'Kosher West', 3.49, null, '');

  -- KIT-026: Scallions Bunch
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Scallions Bunch', 'Produce', 'Kosher West', 0.79, null, '');

  -- KIT-027: Verdini Fresh Dill
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Verdini Fresh Dill', 'Herbs Fresh', 'Kosher West', 1.99, null, '');

  -- KIT-028: Haolam Fancy Mozzarella & Cheese (Sliced)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Haolam Fancy Mozzarella & Cheese (Sliced)', 'Cheese', 'Kosher West', 5.99, null, '');

  -- KIT-029: Pride Of The Farm Fancy Sliced Cheese 16 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pride Of The Farm Fancy Sliced Cheese 16 Oz', 'Cheese', 'Kosher West', 4.99, null, '');

  -- KIT-030: Soy Cheese Deli Smoked Slices
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Soy Cheese Deli Smoked Slices', 'Cheese Alternative', 'Kosher West', 6.99, null, '');

  -- KIT-031: Pas Slimmer's Wheat Wraps Low Carb
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pas Slimmer''s Wheat Wraps Low Carb', 'Bread', 'Kosher West', 3.99, null, '');

  -- KIT-032: Jelly Rings
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Jelly Rings', 'Candy', 'Kosher West', 4.99, null, '');

  -- KIT-033: Poskesz Rolled Wafers Chocolate
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poskesz Rolled Wafers Chocolate', 'Cookie', 'Kosher West', 1.79, null, '');

  -- KIT-034: Pas Mezonos Hot Dog Buns
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pas Mezonos Hot Dog Buns', 'Bread', 'Kosher West', 5.29, null, '');

  -- KIT-035: Gefen Onion Powder Deluxe 8 oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gefen Onion Powder Deluxe 8 oz', 'Spice', 'Kosher West', 6.99, null, '');

  -- KIT-036: Smart Balance Dairy Free Butter
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Smart Balance Dairy Free Butter', 'Butter Alternative', 'Kosher West', 6.49, null, '');

  -- KIT-037: Pretzilla Mini Pretzel Buns 6 Pk
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Pretzilla Mini Pretzel Buns 6 Pk', 'Bread', 'Kosher West', 7.49, null, '');

  -- KIT-038: Haddar 40 Ct Family Pack Matzo
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Haddar 40 Ct Family Pack Matzo', 'Matzo', 'Kosher West', 7.49, null, '');

  -- KIT-039: Navel Pastrami
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Navel Pastrami', 'Meat Deli', 'Kosher West', 29.99, null, '');

  -- KIT-040: Osem Consomme (Chicken) Soup Mix
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Osem Consomme (Chicken) Soup Mix', 'Soup Mix', 'Kosher West', 7.99, null, '');

  -- KIT-041: Schwartz Appetizing Spicy Smoked Beef
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Schwartz Appetizing Spicy Smoked Beef', 'Meat Deli', 'Kosher West', 6.99, null, '');

  -- KIT-042: Babka Amareto Ring
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Babka Amareto Ring', 'Dessert', 'Kosher West', 14.99, null, '');

  -- KIT-043: Kedem Grape Juice 22 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Kedem Grape Juice 22 Oz', 'Beverage', 'Kosher West', 3.99, null, '');

  -- KIT-044: Tomatoes Grape
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tomatoes Grape', 'Produce', 'Kosher West', 2.99, null, '');

  -- KIT-045: Side Of Salmon
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Side Of Salmon', 'Fish', 'Kosher West', 11.99, null, '');

  -- KIT-046: Milk Munch Chocolate Bar
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Milk Munch Chocolate Bar', 'Candy', 'Kosher West', 1.5, null, '');

  -- KIT-047: Gushers Variety Pack
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gushers Variety Pack', 'Candy', 'Kosher West', 4.99, null, '');

  -- KIT-048: Haolam Light Cream Cheese
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Haolam Light Cream Cheese', 'Cheese', 'Kosher West', 3.99, null, '');

  -- KIT-049: Stella Doro Swiss Fudge Cookies 8 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Stella Doro Swiss Fudge Cookies 8 Oz', 'Cookie', 'Kosher West', 4.99, null, '');

  -- KIT-050: Meal Mart Kishka 16 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Meal Mart Kishka 16 Oz', 'Meat', 'Kosher West', 5.99, null, '');

  -- KIT-051: Jet Foil 5Lb Pans With Lid 4 Ct
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Jet Foil 5Lb Pans With Lid 4 Ct', 'Disposable', 'Kosher West', 4.49, null, '');

  -- KIT-052: Ground Beef 1 Lb
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Ground Beef 1 Lb', 'Meat', 'Kosher West', 8.99, null, '');

  -- KIT-053: Dill Pickles Purple Cabbage 16 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dill Pickles Purple Cabbage 16 Oz', 'Pickles', 'Kosher West', 3.99, null, '');

  -- KIT-054: Corn Poppin Pizza Cheese & Snack
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Corn Poppin Pizza Cheese & Snack', 'Snack', 'Kosher West', 4.99, null, '');

  -- KIT-055: Yellow Onion 5lb Bag
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Yellow Onion 5lb Bag', 'Produce', 'Kosher West', 3.99, null, '');

  -- KIT-056: Babka Iced Cinnamon Buns
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Babka Iced Cinnamon Buns', 'Bread Dessert', 'Kosher West', 9.99, null, '');

  -- KIT-057: Flanken Roast
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Flanken Roast', 'Meat', 'Kosher West', 34.99, null, '');

  -- KIT-058: Elite Must Spearmint Gum
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Elite Must Spearmint Gum', 'Candy', 'Kosher West', 3.49, null, '');

  -- KIT-059: Lieber's Chick Peas 15 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lieber''s Chick Peas 15 Oz', 'Legumes Canned', 'Kosher West', 1.89, null, '');

  -- KIT-060: Norman's Lowfat Vanilla Yogurt
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Norman''s Lowfat Vanilla Yogurt', 'Dairy', 'Kosher West', 2.5, null, '');

  -- KIT-061: Drizzilicious Cinnamon Swirl
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Drizzilicious Cinnamon Swirl', 'Snack', 'Kosher West', 9.49, null, '');

  -- KIT-062: Peeled Garlic 1 Lb
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Peeled Garlic 1 Lb', 'Produce Prepared', 'Kosher West', 6.99, null, '');

  -- KIT-063: Liebers Mini Snackers Family Pack
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Liebers Mini Snackers Family Pack', 'Candy', 'Kosher West', 5.99, null, '');

  -- KIT-064: Klein's Natural Granola 12 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Klein''s Natural Granola 12 Oz', 'Cereal', 'Kosher West', 5.75, null, '');

  -- KIT-065: Byun Crushed Garlic Cubes 2.8 oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Byun Crushed Garlic Cubes 2.8 oz', 'Condiment', 'Kosher West', 4.49, null, '');

  -- KIT-066: Rib Steak Family Pack
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Rib Steak Family Pack', 'Meat', 'Kosher West', 14.49, null, '');

  -- KIT-067: The Kosher Cook Kitchen Knife
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen drawer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen drawer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'The Kosher Cook Kitchen Knife', 'Tool Utensil', 'Kosher West', 7.99, null, '');

  -- KIT-068: Lieber's Peanut Butter Pretzels
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lieber''s Peanut Butter Pretzels', 'Snack', 'Kosher West', 0.69, null, '');

  -- KIT-069: Made Good Chocolate Chip Cookies
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Made Good Chocolate Chip Cookies', 'Cookie Snack', 'Kosher West', 5.49, null, '');

  -- KIT-070: Ortega Fajita Seasoning Kit 1 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Ortega Fajita Seasoning Kit 1 Oz', 'Spice Mix', 'Kosher West', 1.49, null, '');

  -- KIT-071: Ortega Taco Seasoning Mix
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Ortega Taco Seasoning Mix', 'Spice Mix', 'Kosher West', 1.49, null, '');

  -- KIT-072: Poskesz Encores Bites Unwrapped
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poskesz Encores Bites Unwrapped', 'Snack Candy', 'Kosher West', 3.99, null, '');

  -- KIT-073: Alprose Napolitains Mix
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Alprose Napolitains Mix', 'Chocolate Candy', 'Kosher West', 8.99, null, '');

  -- KIT-074: Cauliflower Blossom
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Cauliflower Blossom', 'Produce Fresh', 'Kosher West', 8.99, null, '');

  -- KIT-075: Hanover Sugar Snap Peas 12 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Hanover Sugar Snap Peas 12 Oz', 'Frozen Vegetables', 'Kosher West', 3.99, null, '');

  -- KIT-076: Stemless Wine Tasters 4 Oz 8 Ct
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Stemless Wine Tasters 4 Oz 8 Ct', 'Glassware', 'Kosher West', 4.99, null, '');

  -- KIT-077: Sizgit Hoola Hoops Flavored Onion Rings
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sizgit Hoola Hoops Flavored Onion Rings', 'Snack Chips', 'Kosher West', 0.89, null, '');

  -- KIT-078: Sizgit Onion Garlic Wheelz 0.5 Oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sizgit Onion Garlic Wheelz 0.5 Oz', 'Snack Chips', 'Kosher West', 0.89, null, '');

  -- KIT-079: Sunny Kits Rosemary
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sunny Kits Rosemary', 'Herb Fresh', 'Kosher West', 1.99, null, '');

  -- KIT-080: Beef Bones Soup Bones
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Beef Bones Soup Bones', 'Meat', 'Kosher West', 6.99, null, '');

  -- KIT-081: Osem Seasoned Beef Instant Boillon
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Osem Seasoned Beef Instant Boillon', 'Seasoning Broth', 'Kosher West', 2.99, null, '');

  -- KIT-082: Gefen Onion Rings Frozen Fresh Made
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Gefen Onion Rings Frozen Fresh Made', 'Frozen Vegetables', 'Kosher West', 3.99, null, '');

  -- KIT-083: Smart Balance Peanut Butter Creamy
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Smart Balance Peanut Butter Creamy', 'Spread', 'Kosher West', 4.99, null, '');

  -- KIT-084: 9X13 Extra Deep Pan
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen cabinet';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen cabinet') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, '9X13 Extra Deep Pan', 'Baking Pan Disposable', 'Kosher West', 0.99, null, '');

  -- CLN-012: Arm & Hammer Baking Soda
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Basement Bath / Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Basement Bath / Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Arm & Hammer Baking Soda', 'Cleaning/Baking', 'Costco', null, 'https://drive.google.com/thumbnail?id=1J5ngoax8qagg_s8W2XwSo54MDh4s0PUA&sz=w500', 'Added from real order history (Costco, delivered Jun 8, $64.44 order) - real product photo confirmed on file');

  -- BBED-035: Band-Aid Variety Pack (30ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Band-Aid Variety Pack (30ct)', 'First Aid', 'Costco', null, 'https://drive.google.com/thumbnail?id=1GELA-xhIyF2hLeqBLU2yL_X1wE5vH7oZ&sz=w500', 'Added from real order history (Costco, delivered Jun 13, $109.43 order) - real product photo confirmed on file');

  -- BCOM-022: Canada Dry Ginger Ale (40-pack)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Canada Dry Ginger Ale (40-pack)', 'Canned Beverage', 'Sam''s Club', null, 'https://drive.google.com/thumbnail?id=1od4WMJb7Zf0K4JVdMwjI1A1rpWVDvKgm&sz=w500', 'Added from real order history - real product photo confirmed on file; also ordered via Walmart (Jun 28) and Costco (Jun 7) \');

  -- BCOM-023: Coca Cola Zero Sugar Soda Cans (35ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Coca Cola Zero Sugar Soda Cans (35ct)', 'Canned Beverage', 'Sam''s Club', 22.79, 'https://drive.google.com/thumbnail?id=18pNhDGw8cVzXW3mizvk_mGsvaOKr3q2o&sz=w500', 'Added from order history (repeat item: Walmart Jun 28, Sam''s Club Jun 25) - no photo on file yet \');

  -- BCOM-024: Sprite Soda Zero Sugar Lemon Lime (35ct)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sprite Soda Zero Sugar Lemon Lime (35ct)', 'Canned Beverage', 'Sam''s Club', 22.79, 'https://drive.google.com/thumbnail?id=1BiDgC-J7yxtWCdy8aROtygSgHdMHOGtf&sz=w500', 'Added from order history (Sam''s Club, delivered Jun 25) \');

  -- BCOM-025: Dr Pepper Zero Sugar
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Dr Pepper Zero Sugar', 'Canned Beverage', 'Walmart', null, null, 'Added from order history (Walmart, delivered Jun 4)');

  -- BCOM-026: Schweppes Ginger Ale (multi-pack)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Schweppes Ginger Ale (multi-pack)', 'Canned Beverage', 'Walmart', null, null, 'Added from order history (Walmart, delivered Jun 28)');

  -- BCOM-027: Tropicana Pure Premium Orange Juice
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tropicana Pure Premium Orange Juice', 'Beverage', 'Costco', null, null, 'Added from order history (repeat item: Costco Jun 13, Walmart Jun 4)');

  -- KIT-085: Heinz Apple Cider Vinegar (2-pack)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Heinz Apple Cider Vinegar (2-pack)', 'Vinegar', 'Costco', null, null, 'Added from order history (Costco, delivered Jun 8, $64.44 order)');

  -- KIT-086: Chobani Plain/Vanilla Greek Yogurt (tub)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Chobani Plain/Vanilla Greek Yogurt (tub)', 'Dairy', 'Costco', null, null, 'Added from order history (Costco, delivered Jun 15, $60.54 order)');

  -- KIT-087: Lundberg Organic Jasmine Rice 32oz
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Lundberg Organic Jasmine Rice 32oz', 'Pantry', 'Gourmet Glatt', null, null, 'Added from order history (Gourmet Glatt, delivered Jun 17, $47.02 order)');

  -- CLN-013: Tide HE Turbo Clean Liquid Detergent
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tide HE Turbo Clean Liquid Detergent', 'Laundry', 'Costco', null, null, 'Added from order history (Costco, delivered Jun 7, $52.33 order) - Note: filed under CLN to match existing detergent pattern, consider moving to LDY zone');

  -- BCOM-028: Milk (1 gallon)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Refrigerator';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Refrigerator') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Milk (1 gallon)', 'Dairy', 'Bingo Wholesale', null, null, 'Added from order history (Bingo Wholesale, delivered Jun 5, $18.42 order) - new supplier not previously in system');

  -- BBED-036: Irish Spring Body Wash
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Irish Spring Body Wash', 'Body Care', 'Costco', null, null, 'Added from order history (Costco, delivered Jun 8)');

  -- BBED-037: Benadryl Allergy Relief (Liqui-Gels + Ultratabs)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath vanity';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath vanity') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Benadryl Allergy Relief (Liqui-Gels + Ultratabs)', 'OTC Medicine', 'Walmart', null, null, 'Added from order history (Walmart, delivered Jun 28, 5-item order)');

  -- BBED-038: up&up 100ct 2-Ply Premium Disposable Napkins
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Bath drawer / Kitchen';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Bath drawer / Kitchen') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'up&up 100ct 2-Ply Premium Disposable Napkins', 'Paper Goods', 'Target', null, null, 'Real product name confirmed from order history');

  -- LDY-006: Huggies Little Movers Diapers Size 4 (22-37 lbs)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Huggies Little Movers Diapers Size 4 (22-37 lbs)', 'Baby Diapers', 'Target', null, null, 'Real product name/size confirmed from order history');

  -- LDY-007: Huggies Overnites Diapers Size 4
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Huggies Overnites Diapers Size 4', 'Baby Diapers', 'Target', null, null, 'Real product name/size confirmed from order history');

  -- KIT-088: Yasso Frozen Greek Yogurt Bars - Chocolate Chip Cookie Dough
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Yasso Frozen Greek Yogurt Bars - Chocolate Chip Cookie Dough', 'Frozen Dessert', 'Walmart', 5.48, null, 'Real product confirmed - $5.48, 4x3.5floz');

  -- KIT-089: Yasso Frozen Greek Yogurt Bars - Fudge Brownie
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Yasso Frozen Greek Yogurt Bars - Fudge Brownie', 'Frozen Dessert', 'Walmart', 5.48, null, 'Real product confirmed - $5.48, 4x3.5floz');

  -- KIT-090: Yasso Frozen Greek Yogurt Bars - Coffee Chocolate Chip
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Freezer';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Freezer') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Yasso Frozen Greek Yogurt Bars - Coffee Chocolate Chip', 'Frozen Dessert', 'Walmart', 5.48, null, 'Real product confirmed - $5.48, 4ct');

  -- BCOM-029: Polar Seltzer Variety Pack
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Polar Seltzer Variety Pack', 'Canned Beverage', 'Sam''s Club', 12.85, null, 'Real order confirmed, delivered to 103 Banyan Circle');

  -- KIT-091: Poland Spring Maine Spring Water 16.9oz (40-pack)
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Poland Spring Maine Spring Water 16.9oz (40-pack)', 'Bottled Water', 'Sam''s Club', 7.7, null, 'Real order confirmed - qty 3 ordered');

  -- KIT-092: Solely Organic Fruit Jerky Variety Pack 16-count
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Solely Organic Fruit Jerky Variety Pack 16-count', 'Snack', 'Costco', 18.69, null, 'Real order confirmed - resolves prior ''unclear snack pack'' item');

  -- KIT-093: Green Seedless Grapes 3lbs
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Green Seedless Grapes 3lbs', 'Produce', 'Costco', 8.79, null, 'Real order confirmed, delivered 6 Grant Avenue');

  -- KIT-094: Cantaloupe 2-count
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Cantaloupe 2-count', 'Produce', 'Costco', 5.49, null, 'Real order confirmed');

  -- KIT-095: Yellow Peaches 4lbs
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Yellow Peaches 4lbs', 'Produce', 'Costco', 10.99, null, 'Real order confirmed');

  -- KIT-096: Mini Watermelon 2-count
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Produce bin';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Produce bin') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Mini Watermelon 2-count', 'Produce', 'Costco', null, null, 'Real order confirmed, price cut off in screenshot');

  -- BCOM-030: Coca-Cola 24 x 12oz cans
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Coca-Cola 24 x 12oz cans', 'Canned Beverage', 'Walmart', null, null, 'From order history batch, delivered Apr 22');

  -- BCOM-031: Sprite 12 x 12oz cans
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Beverage fridge';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Beverage fridge') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Sprite 12 x 12oz cans', 'Canned Beverage', 'Walmart', 16.28, null, 'From order history batch, delivered Apr 23 (2-item order)');

  -- CLN-014: Bounty Paper Towels 12x120 sheets
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Bounty Paper Towels 12x120 sheets', 'Paper Goods', 'Walmart', null, null, 'From order history batch - multiple Bounty variants ordered (12x120, 24x120, 12 Double Rolls, 35-Pack Variety) - exact variant kept needs confirming');

  -- CLN-015: Tide PODS Laundry Detergent
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Laundry Room';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Laundry Room') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Tide PODS Laundry Detergent', 'Laundry', 'Walmart', 43.71, null, 'From order history batch, delivered May 4 - distinct from Tide HE Turbo Clean liquid (CLN-013)');

  -- KIT-097: Orbit Gum
  select id into v_location_id from public.locations where property_id = v_property_id and name = 'Kitchen pantry';
  if v_location_id is null then
    insert into public.locations (property_id, name) values (v_property_id, 'Kitchen pantry') returning id into v_location_id;
  end if;
  insert into public.inventory_items (property_id, location_id, name, category, supplier, unit_cost, photo_url, notes)
  values (v_property_id, v_location_id, 'Orbit Gum', 'Candy', 'Costco', 49.96, null, 'From order history batch, delivered ~May 5 - 4 items in order');

end $$;