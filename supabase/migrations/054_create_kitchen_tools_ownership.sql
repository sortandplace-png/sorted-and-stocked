-- Canonical tools dictionary + real per-property ownership tracking,
-- replacing the recipe-level free-text equipment chip list as the source
-- of truth for "does this household own this." recipes.equipment is left
-- as-is (still what each recipe actually needs) -- ownership is a
-- household-level fact, not a per-recipe one, so it lives on its own table
-- joined by tool name, not attached to the recipe.
--
-- Seeded directly from the real distinct equipment values already used
-- across all 298 recipes (checked live: only 14 distinct case-insensitive
-- names, no messy near-duplicates), not a fuzzy/similarity match -- this
-- codebase already learned that lesson the hard way with the staples
-- table (its own comment: auto substring/similarity matching against
-- inventory_items produced false positives like salt matching shampoo).
-- Reconciliation here is a simple lower(trim()) equality join, which is
-- safe precisely because the real data has no ambiguous near-duplicates
-- to false-positive against.

create table kitchen_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table kitchen_tools enable row level security;

create policy "authenticated users can read kitchen_tools" on kitchen_tools
  for select to authenticated using (true);

insert into kitchen_tools (name) values
  ('9x13 Pan'), ('Baking Sheet'), ('Blender'), ('Dutch Oven'), ('Food Processor'),
  ('Grill'), ('Ice Cream Maker'), ('Immersion Blender'), ('Mixer'), ('Mixing Bowl'),
  ('Muffin Tin'), ('Roasting Pan'), ('Skillet'), ('Slow Cooker');

create table household_tool_ownership (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tool_id uuid not null references kitchen_tools(id) on delete cascade,
  owned boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (property_id, tool_id)
);

alter table household_tool_ownership enable row level security;

create policy household_tool_ownership_all_member on household_tool_ownership
  for all using (is_property_member(property_id)) with check (is_property_member(property_id));
