-- 175: asset-ingestion job queue (2 Aug asset drop).
-- Racquel's 137-file generated library landed as a 143.9MB link-shared
-- Drive zip. No path can move those bytes through the Code container (MCP
-- download caps at 10MB; the egress proxy blocks Drive; pg_net mangles
-- binary) -- but the PRODUCTION deployment has the service-role key,
-- unrestricted egress, and clean binary handling. So ingestion runs as an
-- API route on Vercel (app/api/assets/ingest), and this table is both its
-- work queue and its authentication:
--   * a job row is created only via service-role/SQL (RLS with NO policies
--     hides the table from anon+authenticated entirely);
--   * the route acts only on a queued, fresh job whose random uuid the
--     caller presents -- possession of a valid jobId IS the proof the
--     request came from the database side (pg_net), with no new secret to
--     provision anywhere.
-- 'scan' lists the zip's central directory (READ-ONLY -- the mapping-first
-- rule holds); 'ingest' writes only the explicit file list in payload,
-- created only after Racquel's mapping eyeball.
create table asset_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('scan', 'ingest')),
  payload jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table asset_ingest_jobs enable row level security;
-- Deliberately NO policies: invisible to anon and authenticated; only the
-- service role (the route) and direct SQL touch it.
