-- trg_inventory_items_pesach_status only fired BEFORE INSERT --
-- set_non_food_pesach_status() itself never referenced OLD, so it already
-- works identically for an UPDATE; the gap was purely that the trigger was
-- never registered to fire on one. Scoped to UPDATE OF category (not every
-- UPDATE) so unrelated field edits (qty, location, etc.) don't re-run this
-- check. Same existing guard applies unchanged either way: only overrides
-- an untouched 'needs_review' default, never a value someone explicitly
-- set (via the UI's real review flow or a migration).
drop trigger trg_inventory_items_pesach_status on inventory_items;

create trigger trg_inventory_items_pesach_status
  before insert or update of category on inventory_items
  for each row execute function set_non_food_pesach_status();
