-- 043_add_recipes_bracha_category.sql
-- Brachos field for recipes: reuses the existing bracha_categories lookup
-- table (already wired to inventory_items.bracha_category) instead of a
-- second taxonomy. Deliberately no backfill/auto-assignment here -- which
-- bracha applies is a manual halachic judgment call, not something to
-- infer from ingredient/course data.
alter table recipes add column if not exists bracha_category text references bracha_categories(category);
