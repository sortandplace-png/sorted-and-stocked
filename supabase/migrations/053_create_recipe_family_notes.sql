-- Per-person Family Notes, replacing the single shared recipes.family_notes
-- text column for new usage (that column is left as-is, not migrated --
-- existing shared notes have no single person to attach to, and migrating
-- them to a real person would be guessing). notes stores a markdown subset
-- (bold/italic/list/link only, enforced client-side by the toolbar, not a
-- full markdown grammar) rather than HTML, to avoid a stored-HTML XSS
-- surface. RLS mirrors recipe_substitutions' existing pattern exactly.

create table recipe_family_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  person_id uuid not null references household_people(id) on delete cascade,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (recipe_id, person_id)
);

alter table recipe_family_notes enable row level security;

create policy recipe_family_notes_select_member on recipe_family_notes
  for select using (
    exists (select 1 from recipes r where r.id = recipe_family_notes.recipe_id and is_property_member(r.property_id))
  );

create policy recipe_family_notes_insert_member on recipe_family_notes
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_family_notes.recipe_id and is_property_member(r.property_id))
  );

create policy recipe_family_notes_update_member on recipe_family_notes
  for update using (
    exists (select 1 from recipes r where r.id = recipe_family_notes.recipe_id and is_property_member(r.property_id))
  );

create policy recipe_family_notes_delete_member on recipe_family_notes
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_family_notes.recipe_id and is_property_member(r.property_id))
  );
