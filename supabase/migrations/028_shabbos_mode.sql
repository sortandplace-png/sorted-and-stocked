-- Migration 028: Shabbos Mode - Weekend operational lockdown
ALTER TABLE properties ADD COLUMN IF NOT EXISTS shabbos_mode_active BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS auto_lock_friday_time TIME DEFAULT '14:00:00';

-- Create snapshot table for weekend static lists
CREATE TABLE IF NOT EXISTS shopping_list_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    compiled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    static_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RPC to batch lock and generate the print/static cache for the weekend
CREATE OR REPLACE FUNCTION activate_weekend_lockdown(target_property_id UUID)
RETURNS TABLE (
    shopping_list_snapshot_id UUID,
    total_items_locked INT
) AS $$
DECLARE
    new_snapshot_id UUID;
    item_count INT;
BEGIN
    -- Set status to active for the property record
    UPDATE properties SET shabbos_mode_active = true WHERE id = target_property_id;

    -- Freeze the current active list state into an uneditable weekend snapshot
    INSERT INTO shopping_list_snapshots (property_id, compiled_at, static_payload)
    SELECT
        target_property_id,
        NOW(),
        json_agg(json_build_object('item', ii.name, 'qty', sli.qty_needed, 'unit', ii.unit, 'loc', COALESCE(l.name, 'Unassigned')))
    FROM shopping_list_items sli
    JOIN inventory_items ii ON sli.inventory_item_id = ii.id
    LEFT JOIN locations l ON ii.location_id = l.id
    WHERE ii.property_id = target_property_id AND sli.status = 'pending'
    RETURNING id INTO new_snapshot_id;

    SELECT COUNT(*) INTO item_count
    FROM shopping_list_items sli
    JOIN inventory_items ii ON sli.inventory_item_id = ii.id
    WHERE ii.property_id = target_property_id AND sli.status = 'pending';

    RETURN QUERY SELECT new_snapshot_id, item_count;
END;
$$ LANGUAGE plpgsql;

-- RPC to deactivate weekend mode on Sunday
CREATE OR REPLACE FUNCTION deactivate_weekend_lockdown(target_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE properties SET shabbos_mode_active = false WHERE id = target_property_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
