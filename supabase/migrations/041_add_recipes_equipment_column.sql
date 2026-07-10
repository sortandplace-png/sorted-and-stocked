-- 041_add_recipes_equipment_column.sql
-- Kitchen Tools feature: per-recipe list of required equipment.
alter table recipes add column if not exists equipment text[];
