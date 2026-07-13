-- PHASE 1 -- NOT APPLIED. Written for review only; do not run apply_migration
-- against production until Racquel gives an explicit go-ahead on the design
-- report. See the accompanying report for the full writeup of what changes
-- once this activates.
--
-- Builds the manager (Racquel/Blimie) cross-property platform:
--   1. platform_managers        -- global role, NOT the same as the existing
--      per-property member_role enum value 'manager' (a client's own
--      household manager, still scoped to one property via property_members).
--      Naming collision risk called out explicitly -- these are two
--      unrelated concepts that happen to share the word "manager."
--   2. manager_access_log       -- every manager read of cross-property data
--      gets one row here, written only by the SECURITY DEFINER RPCs below
--      (never client-insertable, so manager_user_id can't be spoofed).
--   3. manager_captured_*       -- passive, trigger-synced copies of every
--      client's inventory_items/recipes/recipe_ingredients. This is the
--      "auto-capture" layer (#2 in spec) -- no client action, invisible to
--      other clients (RLS grants SELECT to platform managers only, nobody
--      else, not even via is_property_member -- these tables have zero
--      relationship to a client's own property membership).
--   4. shared_library_*         -- curated subset a manager has explicitly
--      approved via approve_*_to_library() (#4) -- deliberately NOT the same
--      table as the capture layer, so "visible to a manager" and "goes to
--      new clients" stay two different, separately-controlled things.
--   5. onboard_property_from_library() -- one-time COPY into a new client's
--      own property (#5) -- INSERT ... SELECT, not a live reference, so
--      editing the library later never touches an already-onboarded client.
--      Reorder links carry over as plain copied column values (#6) -- once
--      copied they're the client's own row, editable with zero propagation
--      back to the library.
--
-- DESIGN DECISION -- capture-staging table vs. direct manager-view query:
-- chose physical trigger-synced copy tables (manager_captured_*) over RLS
-- policies granting managers cross-property SELECT directly on
-- inventory_items/recipes. Reasoning: this is the highest-blast-radius
-- security decision in the whole feature, and a copy table means the
-- client-facing RLS on the real inventory_items/recipes tables used by
-- every property in the app is NEVER TOUCHED AT ALL by this feature -- a
-- bug in a manager-only policy can only ever leak the duplicated copy, not
-- open a hole in the live tables every client depends on. Costs: sync
-- triggers to maintain, and the aggregate view is only as fresh as the last
-- write (in practice: immediate, since every INSERT/UPDATE fires the
-- trigger synchronously in the same transaction).
--
-- DESIGN DECISION -- deleted source rows: capture rows are marked
-- source_deleted_at, never removed, so a manager can still see "this client
-- used to stock X" historically. recipe_ingredients captures ARE hard-
-- deleted when the source ingredient is deleted (a line item has no
-- independent historical value the way a whole recipe or inventory item
-- does) -- flagged explicitly in the report as a judgment call, not a
-- symmetry oversight.

-- ============================================================
-- 1. Platform manager role (global, not property-scoped)
-- ============================================================

create table public.platform_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  notes text
);

alter table public.platform_managers enable row level security;

create or replace function public.is_platform_manager(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_managers where user_id = p_user_id);
$$;

-- Only managers can even see the roster -- a compromised client account
-- can't use this table to enumerate who has cross-property access.
create policy "platform_managers: managers can view roster"
  on public.platform_managers for select
  using (public.is_platform_manager(auth.uid()));

-- Deliberately no INSERT/UPDATE/DELETE policy for any role. Granting the
-- single highest-privilege role in the system is not exposed through any
-- client-reachable API path -- it happens via a direct migration/service-
-- role action only. (Seeding Racquel + Blimie is NOT included in this
-- migration -- see the report: Blimie has no auth.users row yet.)

-- ============================================================
-- 2. Access audit log
-- ============================================================

create table public.manager_access_log (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null references auth.users(id),
  property_id uuid references public.properties(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.manager_access_log enable row level security;

create policy "manager_access_log: managers can view the audit trail"
  on public.manager_access_log for select
  using (public.is_platform_manager(auth.uid()));

-- No insert policy for any role -- written exclusively by log_manager_access()
-- below, called from inside every manager-facing RPC using auth.uid() at
-- call time, so the actor can't be spoofed by a client-supplied value.
create or replace function public.log_manager_access(p_property_id uuid, p_action text, p_detail jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_access_log (manager_user_id, property_id, action, detail)
  values (auth.uid(), p_property_id, p_action, p_detail);
end;
$$;

-- ============================================================
-- 3. Auto-capture staging (passive, trigger-synced mirrors)
-- ============================================================

create table public.manager_captured_inventory_items (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null unique,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  name_es text,
  category text,
  photo_url text,
  reorder_link text,
  kosher_type text,
  supplier text,
  first_captured_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  source_deleted_at timestamptz
);

create table public.manager_captured_recipes (
  id uuid primary key default gen_random_uuid(),
  source_recipe_id uuid not null unique,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  name_es text,
  course text,
  servings integer,
  instructions_en text,
  instructions_es text,
  kosher_type text,
  tags text[],
  photo_url text,
  equipment text[],
  approx_total_minutes integer,
  first_captured_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  source_deleted_at timestamptz
);

create table public.manager_captured_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  captured_recipe_id uuid not null references public.manager_captured_recipes(id) on delete cascade,
  source_ingredient_id uuid not null unique,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  reorder_link text,
  photo_url text,
  section_label text
);

alter table public.manager_captured_inventory_items enable row level security;
alter table public.manager_captured_recipes enable row level security;
alter table public.manager_captured_recipe_ingredients enable row level security;

create policy "manager_captured_inventory_items: managers can view"
  on public.manager_captured_inventory_items for select
  using (public.is_platform_manager(auth.uid()));

create policy "manager_captured_recipes: managers can view"
  on public.manager_captured_recipes for select
  using (public.is_platform_manager(auth.uid()));

create policy "manager_captured_recipe_ingredients: managers can view"
  on public.manager_captured_recipe_ingredients for select
  using (public.is_platform_manager(auth.uid()));

-- No write policies anywhere above -- only the SECURITY DEFINER trigger
-- functions below write to these tables (they run as the function owner,
-- which bypasses RLS the same way is_property_member()/has_property_role()
-- already do elsewhere in this schema).

create or replace function public.capture_inventory_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_captured_inventory_items
    (source_item_id, property_id, name, name_es, category, photo_url, reorder_link, kosher_type, supplier, last_synced_at, source_deleted_at)
  values
    (new.id, new.property_id, new.name, new.name_es, new.category, new.photo_url, new.reorder_link, new.kosher_type, new.supplier, now(), null)
  on conflict (source_item_id) do update set
    property_id = excluded.property_id,
    name = excluded.name,
    name_es = excluded.name_es,
    category = excluded.category,
    photo_url = excluded.photo_url,
    reorder_link = excluded.reorder_link,
    kosher_type = excluded.kosher_type,
    supplier = excluded.supplier,
    last_synced_at = now(),
    source_deleted_at = null;
  return new;
end;
$$;

create trigger trg_capture_inventory_item
  after insert or update on public.inventory_items
  for each row execute function public.capture_inventory_item();

create or replace function public.mark_inventory_item_capture_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.manager_captured_inventory_items
  set source_deleted_at = now()
  where source_item_id = old.id;
  return old;
end;
$$;

create trigger trg_capture_inventory_item_deleted
  after delete on public.inventory_items
  for each row execute function public.mark_inventory_item_capture_deleted();

create or replace function public.capture_recipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_captured_recipes
    (source_recipe_id, property_id, name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes, last_synced_at, source_deleted_at)
  values
    (new.id, new.property_id, new.name, new.name_es, new.course, new.servings, new.instructions_en, new.instructions_es, new.kosher_type, new.tags, new.photo_url, new.equipment, new.approx_total_minutes, now(), null)
  on conflict (source_recipe_id) do update set
    property_id = excluded.property_id,
    name = excluded.name,
    name_es = excluded.name_es,
    course = excluded.course,
    servings = excluded.servings,
    instructions_en = excluded.instructions_en,
    instructions_es = excluded.instructions_es,
    kosher_type = excluded.kosher_type,
    tags = excluded.tags,
    photo_url = excluded.photo_url,
    equipment = excluded.equipment,
    approx_total_minutes = excluded.approx_total_minutes,
    last_synced_at = now(),
    source_deleted_at = null;
  return new;
end;
$$;

create trigger trg_capture_recipe
  after insert or update on public.recipes
  for each row execute function public.capture_recipe();

create or replace function public.mark_recipe_capture_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.manager_captured_recipes
  set source_deleted_at = now()
  where source_recipe_id = old.id;
  return old;
end;
$$;

create trigger trg_capture_recipe_deleted
  after delete on public.recipes
  for each row execute function public.mark_recipe_capture_deleted();

-- Ingredient capture looks up its parent by source_recipe_id -- safe even
-- when a recipe and its ingredients are inserted in the same transaction,
-- since trg_capture_recipe fires (and commits its insert, transaction-
-- locally visible) before the app's own ingredient inserts run.
create or replace function public.capture_recipe_ingredient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captured_recipe_id uuid;
begin
  select id into v_captured_recipe_id
  from public.manager_captured_recipes
  where source_recipe_id = new.recipe_id;

  if v_captured_recipe_id is null then
    return new;
  end if;

  insert into public.manager_captured_recipe_ingredients
    (captured_recipe_id, source_ingredient_id, name, quantity, unit, category, reorder_link, photo_url, section_label)
  values
    (v_captured_recipe_id, new.id, new.name, new.quantity, new.unit, new.category, new.reorder_link, new.photo_url, new.section_label)
  on conflict (source_ingredient_id) do update set
    name = excluded.name,
    quantity = excluded.quantity,
    unit = excluded.unit,
    category = excluded.category,
    reorder_link = excluded.reorder_link,
    photo_url = excluded.photo_url,
    section_label = excluded.section_label;
  return new;
end;
$$;

create trigger trg_capture_recipe_ingredient
  after insert or update on public.recipe_ingredients
  for each row execute function public.capture_recipe_ingredient();

-- Ingredients are hard-deleted from the capture layer on source delete
-- (unlike inventory items/recipes, which are soft-marked) -- a line item
-- has no independent historical value once its parent recipe still exists
-- and simply dropped one ingredient.
create or replace function public.delete_recipe_ingredient_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.manager_captured_recipe_ingredients where source_ingredient_id = old.id;
  return old;
end;
$$;

create trigger trg_capture_recipe_ingredient_deleted
  after delete on public.recipe_ingredients
  for each row execute function public.delete_recipe_ingredient_capture();

-- One-time backfill of everything that already exists today, so the
-- aggregate view isn't empty on activation day -- triggers take over for
-- everything from this point forward.
insert into public.manager_captured_inventory_items
  (source_item_id, property_id, name, name_es, category, photo_url, reorder_link, kosher_type, supplier)
select id, property_id, name, name_es, category, photo_url, reorder_link, kosher_type, supplier
from public.inventory_items
on conflict (source_item_id) do nothing;

insert into public.manager_captured_recipes
  (source_recipe_id, property_id, name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes)
select id, property_id, name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes
from public.recipes
on conflict (source_recipe_id) do nothing;

insert into public.manager_captured_recipe_ingredients
  (captured_recipe_id, source_ingredient_id, name, quantity, unit, category, reorder_link, photo_url, section_label)
select mcr.id, ri.id, ri.name, ri.quantity, ri.unit, ri.category, ri.reorder_link, ri.photo_url, ri.section_label
from public.recipe_ingredients ri
join public.manager_captured_recipes mcr on mcr.source_recipe_id = ri.recipe_id
on conflict (source_ingredient_id) do nothing;

-- ============================================================
-- 4. Curated shared starter library (separate from the capture layer)
-- ============================================================

create table public.shared_library_inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_es text,
  category text,
  photo_url text,
  reorder_link text,
  kosher_type text,
  supplier text,
  source_captured_item_id uuid references public.manager_captured_inventory_items(id) on delete set null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.shared_library_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_es text,
  course text,
  servings integer,
  instructions_en text,
  instructions_es text,
  kosher_type text,
  tags text[],
  photo_url text,
  equipment text[],
  approx_total_minutes integer,
  source_captured_recipe_id uuid references public.manager_captured_recipes(id) on delete set null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.shared_library_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  library_recipe_id uuid not null references public.shared_library_recipes(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  reorder_link text,
  photo_url text,
  section_label text
);

alter table public.shared_library_inventory_items enable row level security;
alter table public.shared_library_recipes enable row level security;
alter table public.shared_library_recipe_ingredients enable row level security;

-- Manager-only, full stop -- clients never query this table directly, even
-- read-only. Content only reaches a client property via the one-time copy
-- in onboard_property_from_library() below.
create policy "shared_library_inventory_items: managers can view"
  on public.shared_library_inventory_items for select
  using (public.is_platform_manager(auth.uid()));

create policy "shared_library_recipes: managers can view"
  on public.shared_library_recipes for select
  using (public.is_platform_manager(auth.uid()));

create policy "shared_library_recipe_ingredients: managers can view"
  on public.shared_library_recipe_ingredients for select
  using (public.is_platform_manager(auth.uid()));

create or replace function public.approve_inventory_item_to_library(p_captured_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_library_id uuid;
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.shared_library_inventory_items
    (name, name_es, category, photo_url, reorder_link, kosher_type, supplier, source_captured_item_id, approved_by)
  select name, name_es, category, photo_url, reorder_link, kosher_type, supplier, id, auth.uid()
  from public.manager_captured_inventory_items
  where id = p_captured_item_id
  returning id into v_library_id;

  perform public.log_manager_access(null, 'approve_inventory_item_to_library',
    jsonb_build_object('captured_item_id', p_captured_item_id, 'library_id', v_library_id));

  return v_library_id;
end;
$$;

create or replace function public.approve_recipe_to_library(p_captured_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_library_id uuid;
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  insert into public.shared_library_recipes
    (name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes, source_captured_recipe_id, approved_by)
  select name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes, id, auth.uid()
  from public.manager_captured_recipes
  where id = p_captured_recipe_id
  returning id into v_library_id;

  insert into public.shared_library_recipe_ingredients
    (library_recipe_id, name, quantity, unit, category, reorder_link, photo_url, section_label)
  select v_library_id, name, quantity, unit, category, reorder_link, photo_url, section_label
  from public.manager_captured_recipe_ingredients
  where captured_recipe_id = p_captured_recipe_id;

  perform public.log_manager_access(null, 'approve_recipe_to_library',
    jsonb_build_object('captured_recipe_id', p_captured_recipe_id, 'library_id', v_library_id));

  return v_library_id;
end;
$$;

-- Retiring goes through an RPC rather than a direct UPDATE policy, so it's
-- audit-logged the same way approval is -- consistent "no direct client
-- writes to any manager table" posture across the whole feature.
create or replace function public.retire_library_inventory_item(p_library_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.shared_library_inventory_items set active = false where id = p_library_item_id;
  perform public.log_manager_access(null, 'retire_library_inventory_item', jsonb_build_object('library_id', p_library_item_id));
end;
$$;

create or replace function public.retire_library_recipe(p_library_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.shared_library_recipes set active = false where id = p_library_recipe_id;
  perform public.log_manager_access(null, 'retire_library_recipe', jsonb_build_object('library_id', p_library_recipe_id));
end;
$$;

-- ============================================================
-- 5. Manager aggregate view (#3) -- filterable by property, searchable by name
-- ============================================================

create or replace function public.get_manager_inventory_aggregate(p_property_id uuid default null, p_name_search text default null)
returns table (
  captured_id uuid,
  property_id uuid,
  property_name text,
  name text,
  category text,
  photo_url text,
  reorder_link text,
  kosher_type text,
  supplier text,
  source_deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  perform public.log_manager_access(p_property_id, 'view_aggregate_inventory',
    jsonb_build_object('filtered_to_property', p_property_id is not null, 'name_search', p_name_search));

  return query
    select c.id, c.property_id, p.name, c.name, c.category, c.photo_url, c.reorder_link, c.kosher_type, c.supplier, c.source_deleted_at
    from public.manager_captured_inventory_items c
    join public.properties p on p.id = c.property_id
    where (p_property_id is null or c.property_id = p_property_id)
      and (p_name_search is null or c.name ilike '%' || p_name_search || '%')
    order by p.name, c.name;
end;
$$;

create or replace function public.get_manager_recipes_aggregate(p_property_id uuid default null, p_name_search text default null)
returns table (
  captured_id uuid,
  property_id uuid,
  property_name text,
  name text,
  course text,
  kosher_type text,
  photo_url text,
  source_deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  perform public.log_manager_access(p_property_id, 'view_aggregate_recipes',
    jsonb_build_object('filtered_to_property', p_property_id is not null, 'name_search', p_name_search));

  return query
    select c.id, c.property_id, p.name, c.name, c.course, c.kosher_type, c.photo_url, c.source_deleted_at
    from public.manager_captured_recipes c
    join public.properties p on p.id = c.property_id
    where (p_property_id is null or c.property_id = p_property_id)
      and (p_name_search is null or c.name ilike '%' || p_name_search || '%')
    order by p.name, c.name;
end;
$$;

-- ============================================================
-- 6. Copy-on-onboard (#5, #6) -- one-time COPY, not a live reference
-- ============================================================

-- inventory_items requires current_qty/min_qty/unit -- a freshly-onboarded
-- client starts every item at 0 on hand with a generic "each" unit; they
-- adjust real counts themselves once they actually take inventory. This is
-- a judgment call flagged in the report, not an attempt to guess real
-- starting stock levels for a client we've never inventoried.
--
-- recipe_property_links is populated automatically by the existing
-- recipes_link_to_co_owned_properties trigger (fires on every INSERT into
-- recipes) -- this function does not need to touch that table itself.
create or replace function public.onboard_property_from_library(p_property_id uuid)
returns table(inventory_items_copied integer, recipes_copied integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory_count integer := 0;
  v_recipe_count integer := 0;
  v_old_recipe_id uuid;
  v_new_recipe_id uuid;
begin
  if not public.is_platform_manager(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'Unknown property';
  end if;

  insert into public.inventory_items
    (property_id, name, name_es, category, current_qty, min_qty, unit, photo_url, reorder_link, kosher_type, supplier)
  select p_property_id, name, name_es, category, 0, 0, 'each', photo_url, reorder_link, kosher_type, supplier
  from public.shared_library_inventory_items
  where active;
  get diagnostics v_inventory_count = row_count;

  for v_old_recipe_id in select id from public.shared_library_recipes where active loop
    insert into public.recipes
      (property_id, name, name_es, course, servings, instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes)
    select p_property_id, name, name_es, course, coalesce(servings, 1), instructions_en, instructions_es, kosher_type, tags, photo_url, equipment, approx_total_minutes
    from public.shared_library_recipes
    where id = v_old_recipe_id
    returning id into v_new_recipe_id;

    insert into public.recipe_ingredients
      (recipe_id, name, quantity, unit, category, reorder_link, photo_url, section_label)
    select v_new_recipe_id, name, quantity, unit, category, reorder_link, photo_url, section_label
    from public.shared_library_recipe_ingredients
    where library_recipe_id = v_old_recipe_id;

    v_recipe_count := v_recipe_count + 1;
  end loop;

  perform public.log_manager_access(p_property_id, 'onboard_copy',
    jsonb_build_object('inventory_items_copied', v_inventory_count, 'recipes_copied', v_recipe_count));

  return query select v_inventory_count, v_recipe_count;
end;
$$;
