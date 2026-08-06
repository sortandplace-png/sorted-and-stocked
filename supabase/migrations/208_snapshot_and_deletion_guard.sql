-- 208_snapshot_and_deletion_guard.sql
-- SS-092. Applied live 6 Aug 2026; this file is the repo copy, written
-- after the fact to close the migration drift (apply_migration does not
-- write a repo file).
--
-- NAME NOTE: the filename says "deletion guard" but this migration adds no
-- trigger and blocks no DELETE. It creates the two tables that make a bulk
-- delete DETECTABLE and RECOVERABLE. Keeping the applied name so the repo
-- and supabase_migrations agree; the discrepancy is in the name, not the
-- code.

create table if not exists public.table_row_counts (
  id bigserial primary key,
  captured_at timestamptz not null default now(),
  table_name text not null,
  row_count bigint not null,
  delta_since_previous bigint,
  alert boolean not null default false,
  note text
);

create index if not exists table_row_counts_name_time_idx
  on public.table_row_counts (table_name, captured_at desc);

comment on table public.table_row_counts is
  'Append only census of critical tables. Exists because SS-001 recorded 240 inventory rows deleted by an unidentified source with no way to detect or recover. This detects. table_snapshots recovers.';

create table if not exists public.table_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null default now(),
  table_name text not null,
  row_count bigint not null,
  payload jsonb not null
);

create index if not exists table_snapshots_name_time_idx
  on public.table_snapshots (table_name, captured_at desc);

comment on table public.table_snapshots is
  'Full daily copy of the highest risk tables as jsonb. Recovery path for a bulk delete. Not a substitute for platform backups; it is the layer that survives noticing the loss late.';

alter table public.table_row_counts enable row level security;
alter table public.table_snapshots enable row level security;

-- No policies are added, so with RLS on and grants revoked these are
-- service-role only. That is deliberate: a snapshot payload is a full copy
-- of inventory_items, and anything that could read it could exfiltrate the
-- whole table in one row.
revoke all on public.table_row_counts from anon, authenticated;
revoke all on public.table_snapshots from anon, authenticated;
