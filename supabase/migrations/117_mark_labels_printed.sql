-- Setting label_printed_at from the client (a JS timestamp) would race
-- against trg_inventory_items_updated_at, which sets updated_at = now()
-- server-side on the same UPDATE -- the client's clock is never exactly
-- the DB's, and the trigger's now() call happens strictly after the
-- statement lands, so updated_at would almost always end up a few ms
-- later than a client-supplied label_printed_at. That reads as "Needs
-- Update" the instant a label is printed, every single time. now() is
-- transaction-stable in Postgres (identical value for every call within
-- one transaction) -- doing the update server-side with now() means both
-- columns land on the exact same instant instead.
create or replace function mark_labels_printed(p_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update inventory_items
  set label_printed_at = now()
  where id = any(p_ids);
$$;
