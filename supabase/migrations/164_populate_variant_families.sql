-- 164_populate_variant_families.sql
-- SS-406 (P), data half -- GO ALL 24 ruled 31 Jul (schema was 161).
--
-- 24 global master_products (property_id NULL, bilingual names per R19)
-- and every inventory item whose name is in a family's member list links
-- to it -- matched by exact name, case-insensitively, across ALL
-- properties, so the Lax/Country/Low clones group with their Main
-- namesakes and the cross-house console can finally group on
-- master_product_id.
--
-- variant_label stays NULL deliberately: partitionByProduct() falls back
-- to the item's own name as the variety label, so every variety shows its
-- full name -- which is exactly how the kashrut-colored sponges keep
-- their MEAT (Red) / DAIRY (Blue) / PAREVE (Green) / SHABBOS (Silicone)
-- identity visible at the variant level, as ruled. A shorter curated
-- label can be layered on later per variety without touching this.
--
-- Only items with master_product_id IS NULL are touched; nothing is
-- deleted or renamed (R21). 'Real Techniques Makeup Sponges' is
-- deliberately NOT in the sponge family (different product).

with family(product_name, product_name_es, item_name) as (
  values
    ('Trash Bags', 'Bolsas de Basura', 'Trash Bags'),
    ('Trash Bags', 'Bolsas de Basura', 'Kitchen Trash Bags'),
    ('Trash Bags', 'Bolsas de Basura', 'Laundry Room Trash Bags'),
    ('Trash Bags', 'Bolsas de Basura', 'Glad Small Trash Bags (4 Gallon)'),
    ('Trash Bags', 'Bolsas de Basura', 'Plastic House Ultra Strong Trash Bags'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Kitchen Sponges'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Sponges — DAIRY (Blue)'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Sponges — MEAT (Red)'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Sponges — PAREVE (Green)'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Sponges — SHABBOS (Silicone)'),
    ('Kitchen Sponges', 'Esponjas de Cocina', 'Scotch-Brite Zero Scratch Sponge'),
    ('Facial Tissues', 'Pañuelos Faciales', 'Facial Tissues'),
    ('Facial Tissues', 'Pañuelos Faciales', 'Facial Tissues (Kleenex)'),
    ('Band-Aid Variety Pack', 'Curitas Surtidas', 'Band-Aid Variety Pack (30ct)'),
    ('Band-Aid Variety Pack', 'Curitas Surtidas', 'Band-Aid Variety Pack (Full Size)'),
    ('Purell Hand Sanitizer', 'Desinfectante de Manos Purell', 'Purell Advanced Hand Sanitizer (single-use packets 125 ct)'),
    ('Purell Hand Sanitizer', 'Desinfectante de Manos Purell', 'Purell Advanced Hand Sanitizer (travel)'),
    ('Cabbage', 'Repollo', 'Cabbage'),
    ('Cabbage', 'Repollo', 'Green Cabbage'),
    ('Cabbage', 'Repollo', 'Red Cabbage'),
    ('Paper Towels', 'Toallas de Papel', 'Paper Towels'),
    ('Paper Towels', 'Toallas de Papel', 'Bounty Paper Towels 12x120 sheets'),
    ('Paper Towels', 'Toallas de Papel', 'Pacific Blue Select Multifold Paper Towels (16pk x 125, Case)'),
    ('Aluminum Foil', 'Papel de Aluminio', 'Aluminum Foil'),
    ('Aluminum Foil', 'Papel de Aluminio', 'Reynolds Wrap Heavy Duty Aluminum Foil'),
    ('Aluminum Foil', 'Papel de Aluminio', 'Reynolds Wrap Pre-Cut Pop-Up Foil Sheets (50 ct)'),
    ('Laundry Stain Remover', 'Quitamanchas de Ropa', 'Laundry Stain Remover'),
    ('Laundry Stain Remover', 'Quitamanchas de Ropa', 'OxiClean Max Force Laundry Stain Remover'),
    ('Laundry Stain Remover', 'Quitamanchas de Ropa', 'Shout Triple Acting Laundry Stain Remover'),
    ('Cinnamon', 'Canela', 'Cinnamon (Ground)'),
    ('Cinnamon', 'Canela', 'Cinnamon Sticks'),
    ('Yasso Frozen Greek Yogurt Bars', 'Barras de Yogur Griego Yasso', 'Yasso Frozen Greek Yogurt Bars - Chocolate Chip Cookie Dough'),
    ('Yasso Frozen Greek Yogurt Bars', 'Barras de Yogur Griego Yasso', 'Yasso Frozen Greek Yogurt Bars - Coffee Chocolate Chip'),
    ('Yasso Frozen Greek Yogurt Bars', 'Barras de Yogur Griego Yasso', 'Yasso Frozen Greek Yogurt Bars - Fudge Brownie'),
    ('Ziploc Bags', 'Bolsas Ziploc', 'Ziploc Bags (assorted sizes)'),
    ('Ziploc Bags', 'Bolsas Ziploc', 'Ziploc Freezer Bags, Gallon (40 ct)'),
    ('White Vinegar', 'Vinagre Blanco', 'White Vinegar (Cleaning)'),
    ('White Vinegar', 'Vinagre Blanco', 'White Vinegar (Distilled)'),
    ('Batteries', 'Pilas', 'Batteries (AA)'),
    ('Batteries', 'Pilas', 'Batteries (AAA)'),
    ('Kirkland Signature Eggs', 'Huevos Kirkland', 'Kirkland Signature Eggs, Large (24-count)'),
    ('Kirkland Signature Eggs', 'Huevos Kirkland', 'Kirkland Signature Eggs, Large (5-dozen)'),
    ('Feta Cheese', 'Queso Feta', 'Feta Cheese (Crumbled)'),
    ('Feta Cheese', 'Queso Feta', 'Feta Cheese (Cubed)'),
    ('Coconut Milk', 'Leche de Coco', 'Coconut Milk'),
    ('Coconut Milk', 'Leche de Coco', 'Coconut Milk (Unsweetened, Organic)'),
    ('Brown Sugar', 'Azúcar Morena', 'Brown Sugar'),
    ('Brown Sugar', 'Azúcar Morena', 'Brown Sugar (Kosher for Passover)'),
    ('Onions', 'Cebollas', 'Onions'),
    ('Onions', 'Cebollas', 'Onions (Tri-Color)'),
    ('Muffin Pan', 'Molde para Muffins', 'Muffin Pan (12-cup)'),
    ('Muffin Pan', 'Molde para Muffins', 'Muffin Pan (6-cup)'),
    ('Murphy Oil Soap', 'Jabón de Aceite Murphy', 'Murphy Oil Soap Wood Cleaner (concentrated)'),
    ('Murphy Oil Soap', 'Jabón de Aceite Murphy', 'Murphy Oil Soap Wood Cleaner, Citronella (32 fl oz)'),
    ('Downy Unstopables', 'Perlas Downy Unstopables', 'Downy Unstopables In-wash Scent Booster Beads'),
    ('Downy Unstopables', 'Perlas Downy Unstopables', 'Downy Unstopables In-Wash Scent Booster Beads, Fresh (30.1 oz)'),
    ('Coca-Cola', 'Coca-Cola', 'Coca-Cola'),
    ('Coca-Cola', 'Coca-Cola', 'Coca-Cola Classic (35ct)'),
    ('Splenda', 'Splenda', 'Splenda'),
    ('Splenda', 'Splenda', 'Splenda (No-Calorie Sweetener)')
),
products as (
  insert into master_products (property_id, name, name_es)
  select distinct null::uuid, product_name, product_name_es from family
  on conflict do nothing
  returning id, name
)
update inventory_items i
set master_product_id = p.id
from family f
join products p on p.name = f.product_name
where lower(trim(i.name)) = lower(trim(f.item_name))
  and i.master_product_id is null;
