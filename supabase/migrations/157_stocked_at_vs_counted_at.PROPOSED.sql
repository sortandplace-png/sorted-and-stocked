-- 157_stocked_at_vs_counted_at.PROPOSED.sql
-- *** PROPOSED, NOT APPLIED. Renamed without .PROPOSED and applied only
-- after Racquel rules on the 31 Jul bulk inventory operation (see
-- SS-437 in work_items). Held because the data half changes what the
-- low-stock surfaces show, and the operation it corrects is itself
-- awaiting her ruling. ***
--
-- THE PROBLEM: the 31 Jul bulk operation set current_qty = 1 on ~3,058
-- items, which fired the last-counted trigger, so 1,940 items on Lax,
-- Country and Low (and 1,118 on Main) now carry
-- last_counted_at = 2026-07-31 with no physical count behind it. They
-- read as freshly counted and are excluded from the never-counted state,
-- and their qty of exactly 1 sits at min_qty 1, silently at the low-stock
-- boundary. "Stocked at setup" and "counted by a person" are different
-- facts and need different columns -- overloading last_counted_at is what
-- created this.
--
-- THE FIX, two parts:
--
-- 1. Schema: a stocked_at column. Setup/seed operations write stocked_at;
--    last_counted_at is reserved for a person confirming a real quantity
--    (the count flows in the app already set it; nothing app-side changes).
alter table inventory_items add column stocked_at timestamptz;

comment on column inventory_items.stocked_at is
  'When the item was stocked/seeded by a setup operation. NOT a physical count -- that is last_counted_at, which only a person''s count may set.';

-- 2. Data: move the machine-stamped 31 Jul timestamps off last_counted_at.
--    Scoped tightly to the operation''s signature: stamped 2026-07-31 by
--    the trigger during the bulk qty write (current_qty = 1, min_qty = 1),
--    where inventory_item_history shows a quantity_changed row that day
--    with the no-session actor. Those items return to their true state:
--    stocked, never counted.
update inventory_items i
set stocked_at = i.last_counted_at,
    last_counted_at = null
where i.last_counted_at::date = '2026-07-31'
  and i.current_qty = 1
  and i.min_qty = 1
  and exists (
    select 1 from inventory_item_history h
    where h.inventory_item_id = i.id
      and h.action_type = 'quantity_changed'
      and h.created_at::date = '2026-07-31'
      and h.actor_user_id is null
  );
