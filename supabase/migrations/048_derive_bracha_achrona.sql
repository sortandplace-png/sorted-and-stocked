-- 048_derive_bracha_achrona.sql
-- Mechanical achrona derivation from an already-set bracha_category
-- (rishona) -- this is not psak, the rishona classification itself was
-- already decided by a human for every row this touches. Only the 5
-- tree-fruit "shivat haminim" species (grapes, figs, pomegranates, olives,
-- dates) get Al Ha'eitz; every other tree_fruit item, plus ground_produce/
-- meat_fish_dairy_eggs/beverages_other, falls to the uncontested Borei
-- Nefashos catch-all. Any bracha_category value NOT covered by this rule
-- (none exist in current data) falls through to null + bracha_needs_sourcing
-- = true rather than being guessed.
update recipes set
  bracha_achrona = case
    when bracha_category = 'bread' then 'Birkat Hamazon'
    when bracha_category = 'grain_mezonos' then 'Al Hamichyah'
    when bracha_category = 'tree_fruit' and name ~* '\y(grapes?|figs?|pomegranates?|olives?|dates?)\y' then 'Al Ha''eitz'
    when bracha_category = 'wine_grape_juice' then 'Al Hagefen'
    when bracha_category = 'tree_fruit' then 'Borei Nefashos'
    when bracha_category in ('ground_produce','meat_fish_dairy_eggs','beverages_other') then 'Borei Nefashos'
    else null
  end
where bracha_category is not null;

update recipes set bracha_needs_sourcing = true
where bracha_category is not null and bracha_achrona is null;

update inventory_items set
  bracha_achrona = case
    when bracha_category = 'bread' then 'Birkat Hamazon'
    when bracha_category = 'grain_mezonos' then 'Al Hamichyah'
    when bracha_category = 'tree_fruit' and name ~* '\y(grapes?|figs?|pomegranates?|olives?|dates?)\y' then 'Al Ha''eitz'
    when bracha_category = 'wine_grape_juice' then 'Al Hagefen'
    when bracha_category = 'tree_fruit' then 'Borei Nefashos'
    when bracha_category in ('ground_produce','meat_fish_dairy_eggs','beverages_other') then 'Borei Nefashos'
    else null
  end
where bracha_category is not null;

update inventory_items set bracha_needs_sourcing = true
where bracha_category is not null and bracha_achrona is null;
