-- 214_adjust_item_qty_rpc.sql
-- SS-011. Applied live 6 Aug 2026; repo copy written after the fact.
--
-- One call per tap, replacing a client-side read-then-write with a single
-- atomic RPC. SECURITY INVOKER (not DEFINER): RLS decides who may adjust
-- what, so a staff member cannot bump quantity on an item in a house they
-- cannot see -- the earlier client-side update relied on RLS too, this
-- just moves the floor-at-zero and the low-stock recompute server side so
-- both happen in the same statement as the write.
--
-- last_counted_at is NOT set here -- the existing trigger
-- set_last_counted_at_on_qty_change already does that on any current_qty
-- change, and duplicating it here would be two writers for one column.

create or replace function public.adjust_item_qty(
  p_item_id uuid,
  p_delta numeric
)
returns table (
  item_id uuid,
  name text,
  current_qty numeric,
  min_qty numeric,
  is_low boolean,
  last_counted_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_delta = 0 then
    raise exception 'delta must not be zero';
  end if;

  return query
  update public.inventory_items i
     set current_qty = greatest(coalesce(i.current_qty, 0) + p_delta, 0),
         updated_at = now()
   where i.id = p_item_id
  returning i.id, i.name, i.current_qty, i.min_qty,
            public.is_inventory_item_low(i.*), i.last_counted_at;

  if not found then
    raise exception 'item % not found or not visible to this user', p_item_id;
  end if;
end;
$$;

grant execute on function public.adjust_item_qty(uuid, numeric) to authenticated;

comment on function public.adjust_item_qty(uuid, numeric) is
  'SS-011 tap to tally. One call per tap. security invoker so RLS decides who may adjust what; a staff member cannot adjust an item in a house they cannot see. Never goes below zero. Returns the new state including is_low so the card can recolour without a second query. last_counted_at is set by the existing trigger set_last_counted_at_on_qty_change, not here.';
