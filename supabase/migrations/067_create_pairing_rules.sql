-- 3e-ii "Forgot Something": curated common-sense pairs, matched against
-- shopping_list_items.name by case-insensitive substring -- safe here
-- specifically because the seed set is small and each term is specific
-- enough not to false-positive the way generic single-word matching did
-- elsewhere in this app (the staples-table lesson: "salt" matching
-- "shampoo"). Start with 10 real common pairs; expand later.
create table pairing_rules (
  id uuid primary key default gen_random_uuid(),
  item_a text not null,
  item_b text not null,
  created_at timestamptz not null default now()
);

alter table pairing_rules enable row level security;

create policy "authenticated users can read pairing_rules" on pairing_rules
  for select to authenticated using (true);

insert into pairing_rules (item_a, item_b) values
  ('Hot Dogs', 'Hot Dog Buns'),
  ('Hamburger', 'Hamburger Buns'),
  ('Taco Shells', 'Salsa'),
  ('Pasta', 'Parmesan'),
  ('Chips', 'Dip'),
  ('Cereal', 'Milk'),
  ('Peanut Butter', 'Jelly'),
  ('Coffee', 'Creamer'),
  ('Pancake Mix', 'Maple Syrup'),
  ('Bread', 'Butter');
