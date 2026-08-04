-- SS-092/SS-438: the register had no copy anywhere off this database.
-- 578 rows and 1.36M characters that nothing could reconstruct -- and
-- SS-001 records 240 inventory rows deleted in two unattributed bulk
-- events whose evidence was gone before anyone looked (24h log retention).
-- Adds the job mode that writes work_items straight to storage as .md and
-- .csv (Postgres -> file, no model in the path) and the PRIVATE bucket it
-- writes into. Driven daily by pg_cron; see the register-export branch in
-- app/api/assets/ingest/route.ts.
--
-- Applied live 4 Aug via MCP apply_migration
-- (register_export_mode_and_backups_bucket); this file records it.
ALTER TABLE asset_ingest_jobs DROP CONSTRAINT IF EXISTS asset_ingest_jobs_mode_check;
ALTER TABLE asset_ingest_jobs ADD CONSTRAINT asset_ingest_jobs_mode_check
  CHECK (mode = ANY (ARRAY['scan'::text, 'ingest'::text, 'fetch-url'::text, 'thumb'::text, 'register-export'::text]));

-- Private: the register carries every finding about every house. No RLS
-- policies are added, so only the service role (the export route) can
-- read or write it -- same posture as asset_ingest_jobs itself.
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;
