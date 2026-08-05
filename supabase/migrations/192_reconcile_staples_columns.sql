-- 192_reconcile_staples_columns.sql
--
-- RECONCILIATION, NOT A CHANGE. These four columns are ALREADY LIVE. They
-- were applied directly as ALTERs earlier today for the staples model and
-- never got a file, which is the same class of gap as migrations 184 to
-- 187: schema that exists in production and in no repository, so a fresh
-- environment built from this directory would come up missing it.
--
-- Every statement is idempotent (IF NOT EXISTS), so applying this against
-- the live database is a no-op and applying it against a fresh one
-- reproduces what is already there. Verified against information_schema
-- before writing: all four are boolean NOT NULL DEFAULT false.
--
-- DATA IS DELIBERATELY NOT SEEDED HERE. 22 rooms on Lax are flagged
-- is_staple and 68 SOPs are flagged is_staple, but those are Racquel's
-- content decisions, made row by row, not schema. Re-asserting them from a
-- migration would overwrite whatever she has changed since. The columns
-- are the migration; the flags are data.

alter table public.rooms
  add column if not exists is_staple boolean not null default false;

alter table public.rooms
  add column if not exists staple_repeatable boolean not null default false;

alter table public.rooms
  add column if not exists staple_observant_only boolean not null default false;

alter table public.sop_library
  add column if not exists is_staple boolean not null default false;

comment on column public.rooms.is_staple is
  'Staples model. Marked room by room by Racquel; 22 on Lax at the time this file was written. Reconciled into history by migration 192, which did not create it.';

comment on column public.sop_library.is_staple is
  'Staples model. 68 SOPs marked at the time this file was written. Reconciled into history by migration 192, which did not create it.';
