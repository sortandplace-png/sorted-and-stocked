-- Reconciliation file (see 100_add_scanned_pantry_item_rpc.sql's header --
-- same situation: already live, already registered as
-- supabase_migrations.schema_migrations version 20260717023021, no local
-- file until now). Widens search_path from `public` to `public, extensions`
-- -- reproduces the exact live `statements` text verbatim; not a fresh change.
CREATE OR REPLACE FUNCTION add_scanned_pantry_item(
  p_property_id uuid,
  p_name text,
  p_quantity numeric,
  p_ai_category text DEFAULT NULL,
  p_ai_location_hint text DEFAULT NULL,
  p_ai_kosher_guess text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing_id uuid;
  v_location_id uuid;
  v_result jsonb;
BEGIN
  IF p_property_id IS NULL OR p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'property_id and name are required';
  END IF;

  SELECT id INTO v_existing_id
  FROM inventory_items
  WHERE property_id = p_property_id
    AND lower(name) = lower(trim(p_name))
  LIMIT 1;

  IF p_ai_location_hint IS NOT NULL THEN
    SELECT id INTO v_location_id
    FROM locations
    WHERE property_id = p_property_id
      AND name ILIKE '%' || p_ai_location_hint || '%'
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL AND p_ai_category IS NOT NULL THEN
    SELECT id INTO v_location_id
    FROM locations
    WHERE property_id = p_property_id
      AND (
        (p_ai_category = 'Fridge' AND name ILIKE '%fridge%')
        OR (p_ai_category = 'Freezer' AND name ILIKE '%freezer%')
        OR (p_ai_category = 'Pantry' AND name ILIKE '%pantry%')
      )
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE inventory_items
    SET current_qty = p_quantity,
        photo_url = COALESCE(p_photo_url, photo_url),
        location_id = COALESCE(v_location_id, location_id),
        notes = CASE
          WHEN p_ai_kosher_guess IS NOT NULL THEN
            COALESCE(notes || E'\n', '') || 'AI scan ' || now()::date ||
            ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
          ELSE notes
        END,
        last_counted_at = now(),
        updated_at = now()
    WHERE id = v_existing_id;

    v_result := jsonb_build_object('action', 'updated', 'id', v_existing_id, 'name', p_name);
  ELSE
    INSERT INTO inventory_items (
      property_id, name, current_qty, location_id, photo_url, notes, last_counted_at
    ) VALUES (
      p_property_id, trim(p_name), p_quantity, v_location_id, p_photo_url,
      CASE WHEN p_ai_kosher_guess IS NOT NULL THEN
        'AI scan ' || now()::date || ': kosher guess = ' || p_ai_kosher_guess || ' (UNCONFIRMED — verify hechsher before trusting)'
      ELSE NULL END,
      now()
    )
    RETURNING id INTO v_existing_id;

    v_result := jsonb_build_object('action', 'inserted', 'id', v_existing_id, 'name', p_name);
  END IF;

  RETURN v_result;
END;
$$;
