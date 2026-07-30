-- 137_training_video_views.sql
-- SS-364: per-user, per-video onboarding progress. Exactly the columns
-- asked for -- user_id, video_id, first_shown_at, completed_at,
-- dismissed_at -- plus id/created_at for the row itself. A video watched to
-- completion on the actual Training page and a video shown/dismissed/
-- completed in the onboarding modal write to the SAME row (unique on
-- user_id+video_id), which is what makes "a video watched on the Training
-- page must not resurface in a modal" true without extra plumbing.
create table training_video_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references training_videos(id) on delete cascade,
  first_shown_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

alter table training_video_views enable row level security;

-- Own rows only -- this is personal progress, not something a manager needs
-- to see or edit for someone else.
create policy "training_video_views_own_rows" on training_video_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
