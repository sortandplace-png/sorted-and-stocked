-- SS-628/SS-630 step 6: early access now submits through the consultation
-- form. A service_interest VALUE is not a durable record of who was there
-- first -- it is free-form text in an array that any edit can drop, and
-- the grandfather promise would go with it. This is the timestamp that
-- actually carries the cohort.
--
-- A TIMESTAMP, not a boolean, deliberately: grandfathering will need a
-- cutoff ("everyone before launch"), and a yes/no cannot answer that
-- question after the fact.
--
-- Applied live 4 Aug via MCP apply_migration
-- (consultation_requests_early_access_at); this file records it.
ALTER TABLE consultation_requests
  ADD COLUMN IF NOT EXISTS early_access_at timestamptz;

COMMENT ON COLUMN consultation_requests.early_access_at IS
  'SS-628: set when the submission selected early access. The durable grandfather cohort -- never derive that cohort from service_interest, which is editable free text.';
