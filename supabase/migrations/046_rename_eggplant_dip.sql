-- 046_rename_eggplant_dip.sql
-- "Eggplant Dip -- Partial" was reported as missing ingredients/instructions,
-- but verified against live data first: all 7 ingredients were already
-- present and linked to real inventory_items, and instructions_en was
-- already fully written (near word-for-word match to what was requested).
-- The only real gap was the "-- Partial" name suffix -- no separate
-- partial-status column exists on recipes, so this is the whole fix.
update recipes set name = 'Eggplant Dip' where id = 'ad6e6c60-3f24-402d-be06-9faf9ed4f839';
