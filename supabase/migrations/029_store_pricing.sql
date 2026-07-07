-- Migration 029: Multi-store price tracking and optimization
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_kosher_certified BOOLEAN DEFAULT false,
    certifying_org TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, name)
);

CREATE TABLE IF NOT EXISTS item_store_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    price_per_unit NUMERIC(10, 2) NOT NULL,
    last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inventory_item_id, store_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_item_store_pricing_inventory ON item_store_pricing(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_item_store_pricing_store ON item_store_pricing(store_id);

-- Function to find cheapest store route for active shopping list
CREATE OR REPLACE FUNCTION calculate_cheapest_store_route(target_property_id UUID)
RETURNS TABLE (
    recommended_store_name TEXT,
    matched_items_count BIGINT,
    total_estimated_cost NUMERIC(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH StoreTotals AS (
        SELECT
            s.name AS store_name,
            COUNT(isp.id) AS matched_items,
            SUM(COALESCE(sli.qty_needed, 1) * isp.price_per_unit)::NUMERIC(10,2) AS estimated_cost,
            RANK() OVER (ORDER BY SUM(COALESCE(sli.qty_needed, 1) * isp.price_per_unit) ASC) as price_rank
        FROM shopping_list_items sli
        JOIN inventory_items ii ON sli.inventory_item_id = ii.id
        JOIN stores s ON s.property_id = target_property_id
        LEFT JOIN item_store_pricing isp ON isp.inventory_item_id = ii.id AND isp.store_id = s.id
        WHERE ii.property_id = target_property_id AND sli.status = 'pending'
        GROUP BY s.name
        HAVING COUNT(isp.id) > 0
    )
    SELECT
        store_name,
        matched_items,
        estimated_cost
    FROM StoreTotals
    WHERE price_rank = 1;
END;
$$ LANGUAGE plpgsql;
