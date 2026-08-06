-- 213_reorder_link_sync_guard.sql
-- SS-030. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- Three tables hold reorder links -- inventory_items.reorder_link,
-- reorder_sources.url, recipe_ingredients.reorder_link -- and the rule
-- that all three move together was PROSE. It failed 11 times. This makes
-- it a constraint instead of a habit: edit either side (the item column or
-- its preferred source row) and the trigger pushes the value to the other.
--
-- Deliberately one-directional per trigger, not a single shared function:
-- inventory_items -> reorder_sources only touches the PREFERRED source row
-- (a non-preferred alternate link is not overwritten by the item's link),
-- and reorder_sources -> inventory_items only fires when the changed row
-- IS preferred. recipe_ingredients.reorder_link is NOT synced by this
-- migration -- it was out of scope for the trigger, still a separate
-- column to watch by hand until it gets its own pass.

create or replace function public.sync_reorder_link_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reorder_link is distinct from old.reorder_link and new.reorder_link is not null then
    update public.reorder_sources
       set url = new.reorder_link, updated_at = now()
     where inventory_item_id = new.id
       and is_preferred
       and url is distinct from new.reorder_link;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_reorder_link_from_item on public.inventory_items;
create trigger trg_sync_reorder_link_from_item
  after update of reorder_link on public.inventory_items
  for each row execute function public.sync_reorder_link_from_item();

create or replace function public.sync_item_from_preferred_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_preferred and new.url is not null then
    update public.inventory_items
       set reorder_link = new.url, updated_at = now()
     where id = new.inventory_item_id
       and reorder_link is distinct from new.url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_item_from_preferred_source on public.reorder_sources;
create trigger trg_sync_item_from_preferred_source
  after insert or update of url, is_preferred on public.reorder_sources
  for each row execute function public.sync_item_from_preferred_source();

comment on function public.sync_reorder_link_from_item() is
  'SS-030. Three tables hold reorder links and the rule that all three must be updated together was prose, so it failed 11 times. This makes it a constraint instead. Edit either side, both stay in step.';
