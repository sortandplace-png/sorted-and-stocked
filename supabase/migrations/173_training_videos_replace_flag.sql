-- 173: per-clip "Replace" flag for the SS-430 review queue (handbook
-- polish ruling, 2 Aug midnight). Racquel reviews the placed sop clips
-- in-app; a clip with AI artifacts should be flaggable for replacement
-- without approving it and without deleting anything. The flag is a
-- worklist marker, not a state machine: flagged clips stay inactive and
-- stay in the queue, visibly marked, until a replacement upload clears
-- the flag.
alter table training_videos
  add column if not exists replace_requested boolean not null default false;

comment on column training_videos.replace_requested is
  'Owner flagged this clip for re-recording (AI artifacts / quality). Set from the clip review queue; cleared when a replacement is uploaded.';

-- Migration 171 granted update(active) to authenticated for the review
-- queue's approve action; the flag needs the same column-scoped grant.
-- RLS (operator-owner policies from 171) still decides WHO can update.
grant update (replace_requested) on training_videos to authenticated;
