-- Migration 025: Recipe Substitution Notes Table
-- Enables managers to annotate ingredient/method substitutions per recipe
-- Purely additive, no impact to existing data

CREATE TABLE IF NOT EXISTS "recipe_substitutions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipe_id" TEXT NOT NULL UNIQUE,
  "notes" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE
);

-- Index for fast lookup by recipe
CREATE INDEX IF NOT EXISTS "idx_recipe_substitutions_recipe_id" ON "recipe_substitutions"("recipe_id");

-- Enable RLS if using Supabase row-level security
ALTER TABLE "recipe_substitutions" ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read/write
CREATE POLICY "Allow authenticated users" ON "recipe_substitutions"
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
