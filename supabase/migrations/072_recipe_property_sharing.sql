-- Racquel wants one recipe library shared across every property she owns
-- (currently Main House/Strauss and Country House), not a separate silo per
-- property. recipes.property_id stays as-is (the "home"/creating property --
-- still a real, meaningful value, still what new inserts set) but it stops
-- being the sole visibility gate. A many-to-many link table is used instead
-- of a blunt RLS loosening: recipes.property_id's RLS check is a genuine
-- security boundary (is_property_member), not just organizational -- if this
-- app ever has non-Racquel-owned properties, a plain "show all recipes to
-- everyone" change would leak across unrelated tenants. The link table keeps
-- that boundary intact while letting one recipe legitimately belong to
-- multiple properties Racquel herself owns.
--
-- Related tables were checked before this migration: recipe_ingredients,
-- recipe_substitutions, recipe_versions, recipe_favorites,
-- person_food_preferences, recipe_family_notes, meal_plan_entries,
-- shopping_list_item_sources. None of them assume a recipe belongs to
-- exactly one property in a way that breaks under sharing --
-- meal_plan_entries/recipe_favorites/recipe_versions/person_food_preferences
-- already carry their own property_id alongside recipe_id (a meal plan, a
-- favorite, an edit, a preference are inherently per-property regardless of
-- how many properties the recipe itself is visible from); recipe_ingredients/
-- recipe_substitutions/recipe_family_notes have no property_id at all and
-- are recipe-intrinsic, which is exactly the shared behavior wanted (one
-- ingredient list, one set of substitution notes, shared along with the
-- recipe). No structural conflict found anywhere.

create table recipe_property_links (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (recipe_id, property_id)
);

create index recipe_property_links_property_id_idx on recipe_property_links(property_id);
create index recipe_property_links_recipe_id_idx on recipe_property_links(recipe_id);

alter table recipe_property_links enable row level security;

create policy "recipe_property_links: members can read"
  on recipe_property_links for select
  using (is_property_member(property_id));

create policy "recipe_property_links: owners/managers can insert"
  on recipe_property_links for insert
  with check (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));

create policy "recipe_property_links: owners/managers can delete"
  on recipe_property_links for delete
  using (has_property_role(property_id, array['owner'::member_role, 'manager'::member_role]));

-- Backfill: every existing recipe keeps a link to its own home property
-- (zero behavior change on its own), then gets an additional link to every
-- other property that shares an owner with its home property -- this is
-- what actually makes Strauss's 313 recipes show up at Country House too,
-- computed generically from real ownership data rather than hardcoding the
-- two current property ids.
insert into recipe_property_links (recipe_id, property_id)
select r.id, r.property_id
from recipes r
on conflict do nothing;

insert into recipe_property_links (recipe_id, property_id)
select distinct r.id, other_pm.property_id
from recipes r
join property_members home_pm on home_pm.property_id = r.property_id and home_pm.role = 'owner'
join property_members other_pm on other_pm.user_id = home_pm.user_id and other_pm.role = 'owner'
where other_pm.property_id <> r.property_id
on conflict do nothing;

-- Future recipes: whenever a new recipe is inserted for property P, link it
-- to every other property that shares an owner with P too, so "her recipe
-- library" stays one shared library going forward rather than needing every
-- recipe-creation call site in the app to remember to insert extra link rows.
create or replace function link_new_recipe_to_co_owned_properties()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into recipe_property_links (recipe_id, property_id)
  values (new.id, new.property_id)
  on conflict do nothing;

  insert into recipe_property_links (recipe_id, property_id)
  select distinct new.id, other_pm.property_id
  from property_members home_pm
  join property_members other_pm on other_pm.user_id = home_pm.user_id and other_pm.role = 'owner'
  where home_pm.property_id = new.property_id
    and home_pm.role = 'owner'
    and other_pm.property_id <> new.property_id
  on conflict do nothing;

  return new;
end;
$$;

create trigger recipes_link_to_co_owned_properties
  after insert on recipes
  for each row
  execute function link_new_recipe_to_co_owned_properties();

-- Recipes' own RLS: was gated directly on recipes.property_id, which only
-- ever allowed one property to see a given recipe. Now gated on the link
-- table instead, so a recipe with links to both properties is visible from
-- either. recipes.property_id itself is untouched (still set on insert,
-- still meaningful as "home" property) -- only the visibility check changes.
drop policy "recipes_select_member" on recipes;
create policy "recipes_select_member"
  on recipes for select
  using (exists (
    select 1 from recipe_property_links rpl
    where rpl.recipe_id = recipes.id
      and is_property_member(rpl.property_id)
  ));

drop policy "recipes_update_member" on recipes;
create policy "recipes_update_member"
  on recipes for update
  using (exists (
    select 1 from recipe_property_links rpl
    where rpl.recipe_id = recipes.id
      and is_property_member(rpl.property_id)
  ))
  with check (exists (
    select 1 from recipe_property_links rpl
    where rpl.recipe_id = recipes.id
      and is_property_member(rpl.property_id)
  ));

drop policy "recipes_delete_owner_manager" on recipes;
create policy "recipes_delete_owner_manager"
  on recipes for delete
  using (exists (
    select 1 from recipe_property_links rpl
    where rpl.recipe_id = recipes.id
      and has_property_role(rpl.property_id, array['owner'::member_role, 'manager'::member_role])
  ));

-- INSERT policy is untouched (recipes_insert_member, still
-- is_property_member(property_id) against the new row's own property_id) --
-- the trigger above is what fans a freshly inserted recipe out to co-owned
-- properties, not the insert policy itself.
