-- 216_recipe_ingredients_reorder_link_sync.sql
-- SS-030, part 2. Applied live 6 Aug 2026.
--
-- The third of the three tables named in the ticket: inventory_items.
-- reorder_link and reorder_sources.url have synced since migration 213.
-- recipe_ingredients.reorder_link never has -- it is only ever COPIED
-- from the linked inventory item once, at recipe-creation time
-- (components/NewRecipeModal.tsx), and there is no editor anywhere that
-- touches it afterward. Verified live before writing this: 118 rows had
-- already drifted from their linked item's current reorder_link.
--
-- One-way only, item -> ingredient, and deliberately unconditional (no
-- "is not null" guard the way 213's item<->source sync has). A
-- reorder_sources row has its OWN identity as a source and a null url
-- would erase real data, which is why 213 refuses to push null. A
-- recipe_ingredients row has no independent identity for this field at
-- all -- it exists only to mirror the source item -- so if the item's
-- link is cleared, the ingredient's copy should clear too rather than
-- keep serving a stale link forever.

-- Backfill the 118 rows that already drifted, not just future changes.
update public.recipe_ingredients ri
set reorder_link = i.reorder_link
from public.inventory_items i
where i.id = ri.inventory_item_id
  and ri.reorder_link is distinct from i.reorder_link;

create or replace function public.sync_recipe_ingredients_reorder_link_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.recipe_ingredients
     set reorder_link = new.reorder_link
   where inventory_item_id = new.id
     and reorder_link is distinct from new.reorder_link;
  return new;
end;
$$;

drop trigger if exists trg_sync_recipe_ingredients_reorder_link on public.inventory_items;
create trigger trg_sync_recipe_ingredients_reorder_link
  after update of reorder_link on public.inventory_items
  for each row execute function public.sync_recipe_ingredients_reorder_link_from_item();

comment on function public.sync_recipe_ingredients_reorder_link_from_item() is
  'SS-030. The third table in the three-table reorder-link rule (see migration 213). recipe_ingredients.reorder_link is a passive mirror of its linked inventory item -- no UI edits it directly -- so this is one-way only, item to ingredient, unlike the bidirectional item<->reorder_sources sync.';
