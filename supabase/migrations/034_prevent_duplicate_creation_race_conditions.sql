-- ============================================================================
-- 034: Prevent duplicate property and shopping list auto-creation
-- ============================================================================
-- Renamed from the root-level "025_prevent_duplicate_creation_race_conditions.sql"
-- to resolve an ordering-ambiguous duplicate with 025_recipe_substitutions.sql —
-- no functional change, content unchanged.
--
-- OVERVIEW
-- Two race conditions were identified and fixed this session:
-- 1. Duplicate properties being silently created when form submitted twice
-- 2. Duplicate shopping lists when multiple components load simultaneously
--
-- DATABASE SAFEGUARDS
-- This migration adds a unique index on properties to prevent duplicate
-- names per owner, catching any attempts at duplicate creation at the DB level.
--
-- CODE FIXES (applied separately)
-- 1. NewPropertyForm.tsx: Added retry logic when fetching newly created property
-- 2. MealPlanClient.tsx: Added handling for shopping list duplicate insert
-- 3. No changes needed to ShoppingListClient.tsx (already handled correctly)

-- Unique index on properties: prevent duplicate property names per owner
-- Catches duplicate creation attempts even if code submits twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_property_name_per_owner
  ON properties (created_by, LOWER(name));

-- The shopping_lists table already has the correct error handling in the
-- application code. Both ShoppingListClient and MealPlanClient now gracefully
-- handle error code 23505 (unique constraint violation) by re-fetching the
-- already-created list instead of failing.

-- VERIFICATION
-- After applying this migration + code changes:
-- 1. Try to create a duplicate property via NewPropertyForm → should fail with constraint error
-- 2. Multiple simultaneous shopping list creation attempts → should resolve to single list
-- 3. Form retry logic should handle any trigger delays transparently
