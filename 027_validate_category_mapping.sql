-- ============================================================================
-- 027: Validate Category Mapping — Spot-Check Script
-- ============================================================================
-- Run this BEFORE deploying the category fix to production
-- It verifies that granular text categories map correctly to the 15 bucket categories

-- The Mapping Reference (for documentation)
-- =========================================
-- Cleaners (bucket): Stain Remover, Carpet, Glass Care, Shower Care, Abrasive, Toilet Care, All-Purpose, Cleaning, Multi-Surface, Wood/Floor, Scrub Pads
-- Laundry (bucket): Laundry, Fabric Care
-- Personal Care (bucket): Body Care, Oral Care, Shower Dispenser, Cotton & Swabs, Feminine Care, Hair Accessories, Hand Soap, Hair Care, Skin Care, Shaving, Hand Care
-- Health & First Aid (bucket): OTC Medicine, Eye/Lens Care, Skin/First Aid, First Aid, Hand Sanitizer
-- Household & Tools (bucket): Glassware, Accessory, Tool Utensil, PPE/Gloves, Baking Pan Disposable, Health (new staple category)
-- Paper Goods (bucket): Disposables, Disposable, Label Stock, Paper Goods (new staple category)
-- Baby (bucket): Baby Diapers, Baby Wipes, Baby Detergent, Baby (new staple category)
-- Snacks & Candy (bucket): Candy, Snack, Snack Chips, Cookie, Cookie Snack, Chocolate Candy, Snack Candy, Crackers, Dessert
-- Bakery (bucket): Bread, Bread Dessert, Matzo
-- Dairy (bucket): Dairy, Cheese, Cheese Alternative, Butter Alternative
-- Meat & Seafood (bucket): Meat, Meat Deli, Fish, Canned Fish
-- Frozen (bucket): Frozen Dessert, Frozen Vegetables
-- Beverages (bucket): Canned Beverage, Bottled Water, Beverage, Coffee, Tea, Drink Mix
-- Produce (bucket): Herb Fresh, Herbs Fresh, Produce Prepared, Produce Fresh, Produce (new staple category)
-- Ritual/Judaica (bucket): Personal/Ritual
-- Pantry (bucket): Everything else falls through to this default

-- =========================================
-- VALIDATION QUERY 1: Find any mismatches
-- =========================================
-- Shows items where the granular text category doesn't match the assigned bucket
WITH expected_mappings AS (
  SELECT ii.id, ii.name, ii.category AS granular_text,
    CASE ii.category
      WHEN 'Stain Remover' THEN 'Cleaners'
      WHEN 'Carpet / Upholstery' THEN 'Cleaners'
      WHEN 'Glass Care · Refill' THEN 'Cleaners'
      WHEN 'Glass Care' THEN 'Cleaners'
      WHEN 'Shower Care' THEN 'Cleaners'
      WHEN 'Abrasive / All-Purpose' THEN 'Cleaners'
      WHEN 'Toilet Care' THEN 'Cleaners'
      WHEN 'All-Purpose' THEN 'Cleaners'
      WHEN 'Cleaning Supplies' THEN 'Cleaners'
      WHEN 'Cleaning' THEN 'Cleaners'
      WHEN 'Multi-Surface' THEN 'Cleaners'
      WHEN 'Wood / Floor Care' THEN 'Cleaners'
      WHEN 'Scrub Pads' THEN 'Cleaners'
      WHEN 'Cleaning/Baking' THEN 'Cleaners'
      WHEN 'Laundry' THEN 'Laundry'
      WHEN 'Fabric Care' THEN 'Laundry'
      WHEN 'Body Care' THEN 'Personal Care'
      WHEN 'Oral Care' THEN 'Personal Care'
      WHEN 'Shower Dispenser' THEN 'Personal Care'
      WHEN 'Cotton & Swabs' THEN 'Personal Care'
      WHEN 'Feminine Care' THEN 'Personal Care'
      WHEN 'Hair Accessories' THEN 'Personal Care'
      WHEN 'Hand Soap' THEN 'Personal Care'
      WHEN 'Hair Care' THEN 'Personal Care'
      WHEN 'Skin Care' THEN 'Personal Care'
      WHEN 'Shaving' THEN 'Personal Care'
      WHEN 'Hand Care' THEN 'Personal Care'
      WHEN 'OTC Medicine' THEN 'Health & First Aid'
      WHEN 'Eye / Lens Care' THEN 'Health & First Aid'
      WHEN 'Skin / First Aid' THEN 'Health & First Aid'
      WHEN 'First Aid' THEN 'Health & First Aid'
      WHEN 'Hand Sanitizer' THEN 'Health & First Aid'
      WHEN 'Glassware' THEN 'Household & Tools'
      WHEN 'Accessory (durable)' THEN 'Household & Tools'
      WHEN 'Tool Utensil' THEN 'Household & Tools'
      WHEN 'PPE / Gloves' THEN 'Household & Tools'
      WHEN 'Baking Pan Disposable' THEN 'Household & Tools'
      WHEN 'Disposables' THEN 'Paper Goods'
      WHEN 'Disposable' THEN 'Paper Goods'
      WHEN 'Label Stock' THEN 'Paper Goods'
      WHEN 'Baby Diapers' THEN 'Baby'
      WHEN 'Baby Wipes' THEN 'Baby'
      WHEN 'Baby Detergent' THEN 'Baby'
      WHEN 'Candy' THEN 'Snacks & Candy'
      WHEN 'Snack' THEN 'Snacks & Candy'
      WHEN 'Snack Chips' THEN 'Snacks & Candy'
      WHEN 'Cookie' THEN 'Snacks & Candy'
      WHEN 'Cookie Snack' THEN 'Snacks & Candy'
      WHEN 'Chocolate Candy' THEN 'Snacks & Candy'
      WHEN 'Snack Candy' THEN 'Snacks & Candy'
      WHEN 'Crackers' THEN 'Snacks & Candy'
      WHEN 'Dessert' THEN 'Snacks & Candy'
      WHEN 'Bread' THEN 'Bakery'
      WHEN 'Bread Dessert' THEN 'Bakery'
      WHEN 'Matzo' THEN 'Bakery'
      WHEN 'Dairy' THEN 'Dairy'
      WHEN 'Cheese' THEN 'Dairy'
      WHEN 'Cheese Alternative' THEN 'Dairy'
      WHEN 'Butter Alternative' THEN 'Dairy'
      WHEN 'Meat' THEN 'Meat & Seafood'
      WHEN 'Meat Deli' THEN 'Meat & Seafood'
      WHEN 'Fish' THEN 'Meat & Seafood'
      WHEN 'Canned Fish' THEN 'Meat & Seafood'
      WHEN 'Frozen Dessert' THEN 'Frozen'
      WHEN 'Frozen Vegetables' THEN 'Frozen'
      WHEN 'Canned Beverage' THEN 'Beverages'
      WHEN 'Bottled Water' THEN 'Beverages'
      WHEN 'Beverage' THEN 'Beverages'
      WHEN 'Coffee' THEN 'Beverages'
      WHEN 'Tea' THEN 'Beverages'
      WHEN 'Drink Mix' THEN 'Beverages'
      WHEN 'Herb Fresh' THEN 'Produce'
      WHEN 'Herbs Fresh' THEN 'Produce'
      WHEN 'Produce Prepared' THEN 'Produce'
      WHEN 'Produce Fresh' THEN 'Produce'
      WHEN 'Personal / Ritual' THEN 'Ritual/Judaica'
      -- New staple items (added July 7) - bucket-style categories pass through directly
      WHEN 'Baby' THEN 'Baby'
      WHEN 'Health' THEN 'Health & First Aid'
      WHEN 'Household' THEN 'Household & Tools'
      WHEN 'Paper Goods' THEN 'Paper Goods'
      WHEN 'Personal Care' THEN 'Personal Care'
      WHEN 'Produce' THEN 'Produce'
      WHEN 'Spices & Seasonings' THEN 'Pantry'
      WHEN 'Baking' THEN 'Pantry'
      WHEN 'Condiments' THEN 'Pantry'
      WHEN 'Oils & Vinegars' THEN 'Pantry'
      WHEN 'Liquids & Stock' THEN 'Pantry'
      WHEN 'Dairy & Eggs' THEN 'Dairy'
      WHEN 'Grains & Starches' THEN 'Pantry'
      WHEN 'Proteins' THEN 'Meat & Seafood'
      ELSE 'Pantry'
    END AS expected_bucket
  FROM inventory_items ii
)
SELECT
  e.name,
  e.granular_text,
  c.name AS actual_bucket_assigned,
  e.expected_bucket,
  CASE
    WHEN c.name IS NULL THEN 'CRITICAL: No category_id assigned!'
    WHEN c.name != e.expected_bucket THEN 'MISMATCH: Assigned to wrong bucket'
    ELSE 'OK'
  END AS validation_status
FROM expected_mappings e
JOIN inventory_items ii ON ii.id = e.id
LEFT JOIN categories c ON c.id = ii.category_id
WHERE c.name IS DISTINCT FROM e.expected_bucket
  OR c.id IS NULL
ORDER BY validation_status DESC, e.name;

-- =========================================
-- VALIDATION QUERY 2: Count items by bucket
-- =========================================
-- Should show distribution matching the target split (73 Pantry, 22 Beverages, 22 Personal Care, etc.)
SELECT
  c.name AS category_bucket,
  COUNT(ii.id) AS item_count,
  STRING_AGG(ii.name, ', ' ORDER BY ii.name) AS sample_items
FROM inventory_items ii
LEFT JOIN categories c ON ii.category_id = c.id
GROUP BY c.name
ORDER BY item_count DESC;

-- =========================================
-- VALIDATION QUERY 3: Null category_id check
-- =========================================
-- Should return 0 rows - any nulls indicate broken backfill
SELECT COUNT(*) AS null_category_count
FROM inventory_items
WHERE category_id IS NULL;

-- =========================================
-- VALIDATION QUERY 4: Spot-check random items
-- =========================================
-- Pick 10 random items across different granular categories to verify mapping is sensible
SELECT
  ii.name,
  ii.category AS granular_text,
  c.name AS assigned_bucket,
  ii.location_id,
  ii.current_qty,
  ii.supplier
FROM inventory_items ii
LEFT JOIN categories c ON ii.category_id = c.id
WHERE ii.category IN (
  'Cleaners',
  'Personal Care',
  'Health & First Aid',
  'Paper Goods',
  'Laundry',
  'Baby',
  'Pantry',
  'Beverages'
)
ORDER BY RANDOM()
LIMIT 15;

-- =========================================
-- INTERPRETATION GUIDE
-- =========================================
-- Query 1 (Mismatches):
-- - Should return 0 rows if fix is correct
-- - If CRITICAL errors: category_id is NULL (broken)
-- - If MISMATCH errors: item was mapped to wrong bucket
--
-- Query 2 (Distribution):
-- - Pantry 73 ✓
-- - Beverages 22 ✓
-- - Personal Care 22 ✓
-- - Snacks & Candy 19 ✓
-- - Produce 19 ✓
-- - Cleaners 15 ✓
-- - Dairy 10 ✓
-- - Meat & Seafood 10 ✓
-- - Health & First Aid 9 ✓
-- - Paper Goods 8 ✓
-- - Frozen 7 ✓
-- - Bakery 6 ✓
-- - Household & Tools 5 ✓
-- - Baby 4 ✓
-- - Laundry 3 ✓
-- - Ritual/Judaica 1 ✓
--
-- Query 3 (Nulls):
-- - Should show 0 null_category_count
-- - If > 0: items were not backfilled correctly
--
-- Query 4 (Spot-check):
-- - Review a sample across different types
-- - Confirm the granular_text → assigned_bucket mapping looks reasonable
-- - No "Cleaners" item should be in "Frozen", etc.
