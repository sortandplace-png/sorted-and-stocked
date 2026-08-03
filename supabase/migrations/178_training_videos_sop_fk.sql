-- SS-551: procedures and training videos are already linked in data
-- (training_videos.module_ref carries SOP codes on 24 of 32 videos, all
-- matching a real sop_library.sop_code, zero orphans - verified 2 Aug)
-- but module_ref is free text. This makes the link a real FK and
-- backfills it from the exact matches. module_ref stays as-is for the 8
-- curriculum videos (general training, correct as free text).
--
-- Applied live 3 Aug via MCP apply_migration (training_videos_sop_fk);
-- this file records it in the repo history. Backfill verified: 24 of 32
-- rows linked, matching the SS-551 count exactly.
ALTER TABLE training_videos
  ADD COLUMN IF NOT EXISTS sop_id uuid REFERENCES sop_library(id);

UPDATE training_videos tv
SET sop_id = sl.id
FROM sop_library sl
WHERE tv.sop_id IS NULL AND tv.module_ref = sl.sop_code;

COMMENT ON COLUMN training_videos.sop_id IS
  'SS-551: the written procedure this video demonstrates. Backfilled from module_ref exact matches; null for curriculum-level videos.';
