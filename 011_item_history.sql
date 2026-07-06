-- ============================================================================
-- 011: Inventory item history (audit trail)
-- ============================================================================
-- Deliberately implemented as a database trigger, not client-side logging.
-- This means every write path — direct edits, the offline queue replaying
-- later, even a bulk import like strauss_full_data_import.sql — gets logged
-- automatically and identically, with zero changes needed to app code.
-- It also means a person can't bypass logging by calling the API directly.

create table public.inventory_item_history (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties(id) on delete cascade,
  inventory_item_id   uuid references public.inventory_items(id) on delete set null,
  item_name_snapshot  text not null, -- so history reads sensibly even after the item is deleted
  action_type         text not null check (action_type in ('created','updated','quantity_changed','deleted')),
  actor_user_id       uuid references auth.users(id) on delete set null,
  actor_name          text, -- snapshot of profiles.full_name at the time — a later name change shouldn't rewrite history
  field_name          text,
  old_value           text,
  new_value           text,
  created_at          timestamptz not null default now()
);

create index idx_item_history_item on public.inventory_item_history(inventory_item_id);
create index idx_item_history_property on public.inventory_item_history(property_id);
create index idx_item_history_created on public.inventory_item_history(created_at);

alter table public.inventory_item_history enable row level security;

-- Read-only for everyone except the trigger below. No insert/update/delete
-- policy exists for regular users — only the SECURITY DEFINER trigger
-- function can write here, which is the point: history can't be edited
-- or faked from the client.
create policy "item_history_select_member"
  on public.inventory_item_history for select
  using (public.is_property_member(property_id));

create or replace function public.log_inventory_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.inventory_item_history
      (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name)
    values
      (new.property_id, new.id, new.name, 'created', auth.uid(), v_actor_name);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.current_qty is distinct from old.current_qty then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'quantity_changed', auth.uid(), v_actor_name, 'current_qty', old.current_qty::text, new.current_qty::text);
    end if;
    if new.name is distinct from old.name then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', auth.uid(), v_actor_name, 'name', old.name, new.name);
    end if;
    if new.location_id is distinct from old.location_id then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', auth.uid(), v_actor_name, 'location_id', old.location_id::text, new.location_id::text);
    end if;
    if new.category is distinct from old.category then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', auth.uid(), v_actor_name, 'category', old.category, new.category);
    end if;
    if new.min_qty is distinct from old.min_qty then
      insert into public.inventory_item_history
        (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name, field_name, old_value, new_value)
      values
        (new.property_id, new.id, new.name, 'updated', auth.uid(), v_actor_name, 'min_qty', old.min_qty::text, new.min_qty::text);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- inventory_item_id is null here deliberately (the row is already gone,
    -- so a real FK reference would fail) — but PRIOR history rows for this
    -- item keep their reference and just get nulled out automatically by
    -- the "on delete set null" above, preserving them rather than deleting.
    insert into public.inventory_item_history
      (property_id, inventory_item_id, item_name_snapshot, action_type, actor_user_id, actor_name)
    values
      (old.property_id, null, old.name, 'deleted', auth.uid(), v_actor_name);
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_log_inventory_item_change
  after insert or update or delete on public.inventory_items
  for each row execute procedure public.log_inventory_item_change();
