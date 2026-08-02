-- 177: third ingest mode, 'fetch-url' (blog featured images, 2 Aug).
-- The route copies files from a STRICT origin allowlist (our own
-- deployment + drive.usercontent) into storage with the service role --
-- built so repo-staged assets (public/blog-headers/) can land in the
-- marketing bucket matching the live posts' URL convention. Same jobId
-- authentication as the other modes.
alter table asset_ingest_jobs drop constraint asset_ingest_jobs_mode_check;
alter table asset_ingest_jobs add constraint asset_ingest_jobs_mode_check check (mode in ('scan', 'ingest', 'fetch-url'));
