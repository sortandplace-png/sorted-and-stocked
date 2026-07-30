// lib/training-video-views.ts
// SS-364: shared read/write helpers for training_video_views, used by both
// TrainingVideosTab (marks completed_at when a video is watched to the end
// on the real Training page) and the onboarding modal (first_shown_at,
// completed_at, dismissed_at). One place for the upsert shape so the two
// surfaces can't quietly drift on what a "seen" row looks like.
import type { SupabaseClient } from '@supabase/supabase-js';

async function upsertView(
  supabase: SupabaseClient,
  userId: string,
  videoId: string,
  patch: Partial<{ first_shown_at: string; completed_at: string; dismissed_at: string }>
) {
  await supabase
    .from('training_video_views')
    .upsert({ user_id: userId, video_id: videoId, ...patch }, { onConflict: 'user_id,video_id' });
}

export function markVideoCompleted(supabase: SupabaseClient, userId: string, videoId: string) {
  return upsertView(supabase, userId, videoId, { completed_at: new Date().toISOString() });
}

export function markVideoFirstShown(supabase: SupabaseClient, userId: string, videoId: string) {
  return upsertView(supabase, userId, videoId, { first_shown_at: new Date().toISOString() });
}

export function markVideoDismissed(supabase: SupabaseClient, userId: string, videoId: string) {
  return upsertView(supabase, userId, videoId, { dismissed_at: new Date().toISOString() });
}
