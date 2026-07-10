-- 044_fix_platter_e_and_g_ingredients.sql
-- Platter E: replace clementines/grapes/peppers with baby carrots, celery
-- sticks, bell pepper strips. Platter G: replace grapes with grapefruit
-- segments (apples/oranges renamed to sliced form, same inventory items).
-- Confirmed a generic "Grapefruit" inventory item already existed before
-- linking to it -- see session report.
update recipe_ingredients set name = 'Bell Pepper Strips'
  where id = '48c36d20-7200-4b11-9013-6fcecb6ada10';
update recipe_ingredients set name = 'Baby Carrots', inventory_item_id = 'dc193796-fd6f-4715-8083-4828da276b20'
  where id = '822e9228-d5b2-4319-ba31-b7707406a840';
update recipe_ingredients set name = 'Celery Sticks', inventory_item_id = 'beebf8d8-5b0c-4801-a93a-c5d85b6c2b0d'
  where id = 'f9a82531-6191-4c29-88c9-372a19a3ff50';

update recipe_ingredients set name = 'Grapefruit Segments', inventory_item_id = '22eb953f-de93-4ef3-83c0-5097407fdb83'
  where id = '2f5d2754-50bd-4c8f-92ed-f5335ec80a25';
update recipe_ingredients set name = 'Apple Slices'
  where id = '36fecda1-0547-4756-9846-f3300ecd5d43';
update recipe_ingredients set name = 'Orange Slices'
  where id = 'd9302c7a-2165-49c8-b88d-5e8925462bd2';
