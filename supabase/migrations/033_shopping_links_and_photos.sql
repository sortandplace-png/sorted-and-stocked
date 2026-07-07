-- Migration 033: Add shopping links, photos, and store selection to ingredients

-- Add shopping fields to recipe_ingredients table
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS reorder_link TEXT;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS primary_store TEXT;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS alternative_stores TEXT[];
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_strictly_kosher BOOLEAN DEFAULT FALSE;

-- Add food/beverage tag to help categorize items
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT TRUE;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create a deduplicated ingredients reference table for B2B multi-tenant use
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    photo_url TEXT,
    tags TEXT[],
    is_food BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: recipes_to_ingredients (for proper deduplication)
CREATE TABLE IF NOT EXISTS recipes_to_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC,
    unit TEXT,
    notes TEXT,
    reorder_link TEXT,
    primary_store TEXT,
    alternative_stores TEXT[],
    is_strictly_kosher BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recipe_id, ingredient_id)
);

-- Add index for fast lookups
CREATE INDEX idx_recipes_to_ingredients_recipe_id ON recipes_to_ingredients(recipe_id);
CREATE INDEX idx_recipes_to_ingredients_ingredient_id ON recipes_to_ingredients(ingredient_id);
CREATE INDEX idx_ingredients_name ON ingredients(name);

-- Enable RLS on new tables
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes_to_ingredients ENABLE ROW LEVEL SECURITY;

-- Public read access to ingredients reference
CREATE POLICY "Public read ingredients" ON ingredients FOR SELECT USING (true);

-- recipes_to_ingredients - read if user is property member of linked recipe's property
CREATE POLICY "Read linked ingredients" ON recipes_to_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipes_to_ingredients.recipe_id
      AND r.property_id IN (SELECT property_id FROM property_members WHERE user_id = auth.uid())
    )
  );

-- Table for storing Instacart product metadata (cached lookups)
CREATE TABLE IF NOT EXISTS instacart_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_name TEXT NOT NULL,
    instacart_url TEXT,
    product_name TEXT,
    photo_url TEXT,
    price NUMERIC,
    store TEXT DEFAULT 'Instacart',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_instacart_products_ingredient ON instacart_products(ingredient_name);
