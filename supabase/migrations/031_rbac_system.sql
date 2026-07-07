-- Migration 031: Role-Based Access Control for multi-user properties
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff', 'viewer');

CREATE TABLE IF NOT EXISTS property_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'staff',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, user_id)
);

-- Permission matrix table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, action, resource)
);

-- Seed permission matrix
INSERT INTO role_permissions (role, action, resource) VALUES
-- Owner: Full access
('owner', 'create', 'inventory_items'),
('owner', 'update', 'inventory_items'),
('owner', 'delete', 'inventory_items'),
('owner', 'create', 'shopping_lists'),
('owner', 'manage', 'users'),
('owner', 'manage', 'property_settings'),
('owner', 'view', 'analytics'),
('owner', 'activate', 'shabbos_mode'),
-- Manager: Most operations except user/property management
('manager', 'create', 'inventory_items'),
('manager', 'update', 'inventory_items'),
('manager', 'create', 'shopping_lists'),
('manager', 'view', 'analytics'),
('manager', 'activate', 'shabbos_mode'),
-- Staff: Can audit and add items, cannot delete or manage
('staff', 'create', 'inventory_items'),
('staff', 'update', 'inventory_items'),
('staff', 'create', 'shopping_list_items'),
('staff', 'update', 'shopping_list_items'),
-- Viewer: Read-only access
('viewer', 'view', 'inventory_items'),
('viewer', 'view', 'shopping_lists'),
ON CONFLICT DO NOTHING;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
    target_user_id UUID,
    target_property_id UUID,
    target_action TEXT,
    target_resource TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
    has_perm BOOLEAN;
BEGIN
    -- Get user's role at this property
    SELECT pu.role INTO user_role
    FROM property_users pu
    WHERE pu.user_id = target_user_id AND pu.property_id = target_property_id;

    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    -- Check if role has permission
    SELECT EXISTS(
        SELECT 1 FROM role_permissions
        WHERE role = user_role
          AND action = target_action
          AND resource = target_resource
    ) INTO has_perm;

    RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy: Only property members can see property data
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view inventory items from their properties"
    ON inventory_items FOR SELECT
    USING (
        property_id IN (
            SELECT property_id FROM property_users
            WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Only managers/owners can modify inventory
CREATE POLICY "Only managers and owners can modify inventory"
    ON inventory_items FOR UPDATE
    USING (
        user_has_permission(auth.uid(), property_id, 'update', 'inventory_items')
    );

-- RLS Policy: Only managers/owners can create inventory
CREATE POLICY "Only managers and owners can create inventory"
    ON inventory_items FOR INSERT
    WITH CHECK (
        user_has_permission(auth.uid(), property_id, 'create', 'inventory_items')
    );

-- RLS Policy: Only owners can delete inventory
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their property's shopping lists"
    ON shopping_list_items FOR SELECT
    USING (
        shopping_list_id IN (
            SELECT sl.id FROM shopping_lists sl
            WHERE sl.property_id IN (
                SELECT property_id FROM property_users
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Staff can create and modify shopping list items"
    ON shopping_list_items FOR INSERT
    WITH CHECK (
        shopping_list_id IN (
            SELECT sl.id FROM shopping_lists sl
            WHERE sl.property_id IN (
                SELECT property_id FROM property_users
                WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'staff')
            )
        )
    );
