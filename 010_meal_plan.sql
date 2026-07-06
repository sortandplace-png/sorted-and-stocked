-- ============================================================================
-- 010: Meal planning — recipes + weekly calendar
-- ============================================================================

create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name        text not null,
  servings    int not null default 4,
  notes       text,
  created_at  timestamptz not null default now()
);
create index idx_recipes_property_id on public.recipes(property_id);

create table public.recipe_ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  name       text not null,
  quantity   numeric,
  unit       text,
  category   text -- carried onto the shopping list item for aisle grouping
);
create index idx_recipe_ingredients_recipe_id on public.recipe_ingredients(recipe_id);

create table public.meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  plan_date    date not null,
  meal_slot    text not null default 'dinner' check (meal_slot in ('breakfast','lunch','dinner','other')),
  recipe_id    uuid references public.recipes(id) on delete set null,
  custom_name  text, -- for a quick one-off entry with no full recipe behind it
  created_at   timestamptz not null default now()
);
create index idx_meal_plan_entries_property_date on public.meal_plan_entries(property_id, plan_date);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plan_entries enable row level security;

-- recipes: any member can manage; delete restricted like everything else
create policy "recipes_select_member"
  on public.recipes for select using (public.is_property_member(property_id));
create policy "recipes_insert_member"
  on public.recipes for insert with check (public.is_property_member(property_id));
create policy "recipes_update_member"
  on public.recipes for update
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));
create policy "recipes_delete_owner_manager"
  on public.recipes for delete
  using (public.has_property_role(property_id, array['owner','manager']::public.member_role[]));

-- recipe_ingredients: scoped via the parent recipe's property
create policy "recipe_ingredients_select_member"
  on public.recipe_ingredients for select
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_property_member(r.property_id)
  ));
create policy "recipe_ingredients_insert_member"
  on public.recipe_ingredients for insert
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_property_member(r.property_id)
  ));
create policy "recipe_ingredients_update_member"
  on public.recipe_ingredients for update
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_property_member(r.property_id)
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_property_member(r.property_id)
  ));
create policy "recipe_ingredients_delete_member"
  on public.recipe_ingredients for delete
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id and public.is_property_member(r.property_id)
  ));

-- meal_plan_entries: any member can plan/edit; keep it simple, no delete restriction
-- (unlike inventory/recipes) since planning is meant to be low-friction and
-- staff should be able to move a meal without asking an owner.
create policy "meal_plan_entries_select_member"
  on public.meal_plan_entries for select using (public.is_property_member(property_id));
create policy "meal_plan_entries_insert_member"
  on public.meal_plan_entries for insert with check (public.is_property_member(property_id));
create policy "meal_plan_entries_update_member"
  on public.meal_plan_entries for update
  using (public.is_property_member(property_id))
  with check (public.is_property_member(property_id));
create policy "meal_plan_entries_delete_member"
  on public.meal_plan_entries for delete using (public.is_property_member(property_id));
