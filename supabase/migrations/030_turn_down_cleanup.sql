-- Migration 030: Property turn-down and archival management
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'turned_down', 'archived'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS turned_down_at TIMESTAMP WITH TIME ZONE;

-- Function to safely archive a property without losing structural data
CREATE OR REPLACE FUNCTION execute_property_turn_down(target_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- 1. Archive active shopping list items to prevent automated order dispatches
    UPDATE shopping_list_items
    SET status = 'archived'
    FROM inventory_items ii
    WHERE shopping_list_items.inventory_item_id = ii.id
      AND ii.property_id = target_property_id
      AND shopping_list_items.status = 'pending';

    -- 2. Reset counts for all perishable categories back to zero
    UPDATE inventory_items
    SET current_qty = 0, last_counted_at = NULL
    WHERE property_id = target_property_id
      AND category_id IN (
          SELECT id FROM categories
          WHERE name IN ('Produce', 'Bakery', 'Dairy', 'Meat & Seafood', 'Frozen')
      );

    -- 3. Mark the property as turned down in metadata
    UPDATE properties
    SET status = 'turned_down', turned_down_at = NOW()
    WHERE id = target_property_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reactivate a turned-down property
CREATE OR REPLACE FUNCTION reactivate_property_after_turndown(target_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE properties
    SET status = 'active', turned_down_at = NULL
    WHERE id = target_property_id;

    -- Recipes and core structure remain intact
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View for archival auditing
CREATE OR REPLACE VIEW property_archival_audit AS
SELECT
    p.id,
    p.name,
    p.status,
    p.turned_down_at,
    COUNT(ii.id) AS inventory_item_count,
    COUNT(CASE WHEN ii.current_qty > 0 THEN 1 END) AS items_with_stock
FROM properties p
LEFT JOIN inventory_items ii ON p.id = ii.property_id
GROUP BY p.id, p.name, p.status, p.turned_down_at;
