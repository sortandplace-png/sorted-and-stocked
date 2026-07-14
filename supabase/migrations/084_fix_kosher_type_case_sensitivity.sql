-- enforce_recipe_kosher_type compared recipes.kosher_type ('Meat'/'Dairy'/'Parve',
-- capitalized) against inventory_items.kosher_type ('meat'/'dairy'/'parve', lowercase --
-- the only casing its own CHECK constraint allows). Case-sensitive equality meant the
-- conflict branches could never match real data, so the trigger was live but inert.
-- Normalize both sides to lowercase before comparing.
CREATE OR REPLACE FUNCTION public.enforce_recipe_kosher_type()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  recipe_kt text;
  item_kt text;
BEGIN
  IF NEW.inventory_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(kosher_type) INTO recipe_kt FROM recipes WHERE id = NEW.recipe_id;
  SELECT lower(kosher_type) INTO item_kt FROM inventory_items WHERE id = NEW.inventory_item_id;

  IF recipe_kt IS NULL OR item_kt IS NULL THEN
    RETURN NEW;
  END IF;

  IF (recipe_kt = 'meat' AND item_kt = 'dairy')
     OR (recipe_kt = 'dairy' AND item_kt = 'meat')
     OR (recipe_kt = 'parve' AND item_kt IN ('meat', 'dairy')) THEN
    RAISE EXCEPTION 'Kosher type conflict: recipe is % but ingredient (inventory item %) is % -- cannot link a % ingredient to a % recipe.',
      recipe_kt, NEW.inventory_item_id, item_kt, item_kt, recipe_kt;
  END IF;

  RETURN NEW;
END;
$function$;
