-- Migration 032: Fix Staples Table RLS for public access
-- The staples table is a reference table of available staple items
-- It should be readable by all users (authenticated and anonymous)

-- Disable RLS entirely on staples table
ALTER TABLE staples DISABLE ROW LEVEL SECURITY;

-- Alternatively, if you want to keep RLS enabled for future flexibility:
-- ALTER TABLE staples ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read access to staples reference table"
--   ON staples FOR SELECT
--   USING (true);
