-- 215_bulk_delete_guard.sql
-- Applied live 6 Aug 2026; repo copy written after the fact.
--
-- Migration 208 was NAMED snapshot_and_deletion_guard and contained no
-- guard -- flagged when 208 was written back to the repo. This is the
-- guard that name promised: a statement-level AFTER DELETE trigger on the
-- three tables where a bulk loss would be worst (inventory_items,
-- master_tasks, recipes). Every multi-row delete is logged; anything over
-- the limit is also blocked.
--
-- app.bulk_delete_limit defaults to 25 via coalesce, not a column default,
-- because current_setting with the boolean "missing_ok" true returns NULL
-- rather than erroring when the GUC was never set in this session -- the
-- coalesce is what makes an ordinary session (no override) behave as
-- "limit 25" instead of raising on a NULL cast.
--
-- REFERENCING ... AS deleted_rows is a statement-level transition table:
-- one row in bulk_delete_log per DELETE statement, not per deleted row,
-- so a 3,563-row delete logs once with rows_deleted = 3563, not 3563
-- times.

create table if not exists public.bulk_delete_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  table_name text not null,
  rows_deleted integer not null,
  db_user text not null default current_user,
  application_name text,
  blocked boolean not null default false
);

create or replace function public.guard_bulk_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  lim integer := coalesce(current_setting('app.bulk_delete_limit', true)::int, 25);
begin
  select count(*) into n from deleted_rows;

  insert into public.bulk_delete_log (table_name, rows_deleted, application_name, blocked)
  values (tg_table_name, n, current_setting('application_name', true), n > lim);

  if n > lim then
    raise exception
      'BULK DELETE BLOCKED: % rows from % in one statement, limit is %. This guard exists because SS-001 recorded 240 inventory rows deleted by an unidentified source. If this deletion is genuinely intended, run: set local app.bulk_delete_limit = %; in the same transaction.',
      n, tg_table_name, lim, n;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_guard_bulk_delete_inventory on public.inventory_items;
create trigger trg_guard_bulk_delete_inventory
  after delete on public.inventory_items
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete();

drop trigger if exists trg_guard_bulk_delete_tasks on public.master_tasks;
create trigger trg_guard_bulk_delete_tasks
  after delete on public.master_tasks
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete();

drop trigger if exists trg_guard_bulk_delete_recipes on public.recipes;
create trigger trg_guard_bulk_delete_recipes
  after delete on public.recipes
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete();

alter table public.bulk_delete_log enable row level security;
revoke all on public.bulk_delete_log from anon, authenticated;

comment on table public.bulk_delete_log is
  'Every multi row delete on a guarded table, blocked or not. Migration 208 was named snapshot_and_deletion_guard and contained no guard. This is the guard the name promised.';
