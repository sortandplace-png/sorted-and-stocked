-- ============================================================================
-- 026: Staples UI Functions & Shopping List Generation
-- ============================================================================
-- Provides RPC functions to power the Staples tab UI and shopping list generation

-- Function 1: Fetch all staples with current inventory details
CREATE OR REPLACE FUNCTION public.get_staples_with_inventory(
  p_property_id UUID,
  p_shopping_list_id UUID
)
RETURNS TABLE (
  staple_id UUID,
  staple_name TEXT,
  staple_category TEXT,
  default_unit TEXT,
  inventory_item_id UUID,
  current_qty NUMERIC,
  min_qty NUMERIC,
  location_id UUID,
  is_low BOOLEAN,
  already_on_list BOOLEAN
) LANGUAGE SQL STABLE AS $$
  SELECT
    s.id AS staple_id,
    s.name AS staple_name,
    s.category AS staple_category,
    s.default_unit,
    ii.id AS inventory_item_id,
    ii.current_qty,
    ii.min_qty,
    ii.location_id,
    (ii.current_qty <= ii.min_qty) AS is_low,
    EXISTS (
      SELECT 1 FROM shopping_list_items sli
      WHERE sli.shopping_list_id = p_shopping_list_id
        AND sli.inventory_item_id = ii.id
        AND sli.status != 'deleted'
    ) AS already_on_list
  FROM public.staples s
  JOIN public.inventory_items ii ON s.inventory_item_id = ii.id
  WHERE ii.property_id = p_property_id
  ORDER BY s.category ASC, s.name ASC;
$$ SECURITY DEFINER;

-- Function 2: Get shopping list with rich inventory details where available
-- This function powers the shopping list view, showing either full inventory details
-- (photo, reorder link, location) or plain text fallback for unmapped ingredients
CREATE OR REPLACE FUNCTION public.get_shopping_list_with_inventory(
  p_shopping_list_id UUID
)
RETURNS TABLE (
  item_id UUID,
  name TEXT,
  category TEXT,
  qty_needed NUMERIC,
  unit_estimate TEXT,
  status TEXT,
  -- Populated if inventory_item_id exists
  inventory_item_id UUID,
  photo_url TEXT,
  reorder_link TEXT,
  current_stock NUMERIC,
  location_name TEXT,
  supplier TEXT,
  -- Flags to guide UI rendering
  is_rich_item BOOLEAN,
  is_staple_origin BOOLEAN
) LANGUAGE SQL STABLE AS $$
  SELECT
    sli.id AS item_id,
    sli.name,
    sli.category,
    sli.qty_needed,
    r.time_estimate AS unit_estimate,
    sli.status,
    -- Inventory enrichment (null if not linked)
    ii.id AS inventory_item_id,
    ii.photo_url,
    ii.reorder_link,
    ii.current_qty AS current_stock,
    l.name AS location_name,
    ii.supplier,
    -- UI rendering flags
    (ii.id IS NOT NULL) AS is_rich_item,
    (s.id IS NOT NULL) AS is_staple_origin
  FROM public.shopping_list_items sli
  LEFT JOIN public.inventory_items ii ON sli.inventory_item_id = ii.id
  LEFT JOIN public.locations l ON ii.location_id = l.id
  LEFT JOIN public.staples s ON s.inventory_item_id = ii.id
  LEFT JOIN public.recipes r ON sli.recipe_id = r.id
  WHERE sli.shopping_list_id = p_shopping_list_id
    AND sli.status != 'deleted'
  ORDER BY
    -- Organize: staples first (alphabetically), then recipe items (by category, then name)
    CASE WHEN s.id IS NOT NULL THEN 0 ELSE 1 END ASC,
    sli.category ASC,
    sli.name ASC;
$$ SECURITY DEFINER;

-- Function 3: Add a staple to a shopping list (idempotent)
-- Returns the item ID if successful, null if already on list
CREATE OR REPLACE FUNCTION public.add_staple_to_shopping_list(
  p_shopping_list_id UUID,
  p_staple_id UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inventory_item_id UUID;
  v_staple_name TEXT;
  v_staple_category TEXT;
  v_item_id UUID;
BEGIN
  -- Get staple details
  SELECT s.inventory_item_id, s.name, s.category
  INTO v_inventory_item_id, v_staple_name, v_staple_category
  FROM public.staples s
  WHERE s.id = p_staple_id;

  IF v_inventory_item_id IS NULL THEN
    RAISE EXCEPTION 'Staple not found or has no inventory_item_id';
  END IF;

  -- Check if already on list (idempotent)
  SELECT sli.id INTO v_item_id
  FROM public.shopping_list_items sli
  WHERE sli.shopping_list_id = p_shopping_list_id
    AND sli.inventory_item_id = v_inventory_item_id
    AND sli.status != 'deleted';

  IF v_item_id IS NOT NULL THEN
    RETURN v_item_id; -- Already exists, return the existing ID
  END IF;

  -- Create new shopping list item
  INSERT INTO public.shopping_list_items (
    shopping_list_id,
    name,
    category,
    inventory_item_id,
    qty_needed,
    status
  ) VALUES (
    p_shopping_list_id,
    v_staple_name,
    v_staple_category,
    v_inventory_item_id,
    1,
    'pending'
  )
  RETURNING shopping_list_items.id INTO v_item_id;

  RETURN v_item_id;
END;
$$ ;
