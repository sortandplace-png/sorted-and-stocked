-- 049_flag_peanut_butter_cranberry_needs_sourcing.sql
-- Peanut butter's rishona is a real, named 3-way machlokes (not just an
-- achrona question) per Racquel's sourced research; cranberries flagged
-- for the same reason. Leaving bracha_category null (the dispute is at
-- the rishona level, no existing category resolves it) and setting
-- bracha_needs_sourcing directly rather than forcing a category just to
-- hang an achrona off of. Note: inventory_items has no bracha UI surface
-- yet (only the recipe detail page's Bracha card exists) -- this flag is
-- real data with nowhere to display it yet, flagged separately.
update inventory_items set bracha_needs_sourcing = true
where name ilike '%peanut butter%' or name ilike '%cranberr%';
