// lib/training-videos.ts
// One source of truth for WHICH training videos exist: the training_videos
// TABLE.
//
// This file used to export a hardcoded TRAINING_VIDEOS array. That meant the
// list Racquel can edit in the database and the list the app rendered were
// two different things, and they had already drifted -- the table carries 8
// rows with one deactivated, the constant carried its own fixed six. The
// constant is gone. Both /staff/training and the Handbook's Training Videos
// tab read this now.
//
// Signing lives here rather than in either caller because a signed URL can
// only be minted server-side, and doing it in two places is two chances to
// get the per-bucket handling wrong.
//
// What deliberately stays in code: the slug -> route map below. Which page a
// video is ABOUT is a route, and routes are code -- putting them in a text
// column would let a typo produce a 404 with nothing to typecheck against.
// The table decides which videos exist and what they say; this decides where
// "go there now" points.
import type { SupabaseClient } from '@supabase/supabase-js';

/** One hour: long enough to watch a short video, short enough that a copied
 *  URL is not a lasting credential. */
export const SIGNED_URL_TTL_SECONDS = 3600;

export const MY_DAY_VIDEO_PATH = 'sp-06-staff-my-day.mp4';

const HREF_BY_SLUG: Record<string, (propertyId: string) => string> = {
  'sp-02-dashboard': (p) => `/properties/${p}/dashboard`,
  'sp-03-inventory': (p) => `/properties/${p}/inventory`,
  'sp-04-shopping-lists': (p) => `/properties/${p}/shopping-list`,
  'sp-05-recipes-meal-planning': (p) => `/properties/${p}/recipes`,
  'sp-06-staff-my-day': (p) => `/properties/${p}/my-day`,
};

export type TrainingVideo = {
  id: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  durationSeconds: number | null;
  /** Route this video is about, already resolved. Null when it teaches no
   *  single page (the welcome video and the overview). */
  href: string | null;
  /** Null when signing failed -- callers render an honest "unavailable" row
   *  rather than a dead <video> element. */
  signedUrl: string | null;
  captionSignedUrl: string | null;
};

/**
 * Active training videos, in order, with freshly signed URLs.
 *
 * Pass a server-side Supabase client built from the CALLER'S session: these
 * objects are in a private bucket, so training_videos_read_authenticated is
 * what actually decides access and a signed-out caller gets nothing.
 */
export async function getSignedTrainingVideos(
  supabase: SupabaseClient,
  propertyId: string
): Promise<TrainingVideo[]> {
  const { data: rows, error } = await supabase
    .from('training_videos')
    .select(
      'id, slug, bucket, storage_path, title_en, title_es, description_en, description_es, duration_seconds, caption_path'
    )
    .eq('active', true)
    .order('sort_order');

  if (error || !rows) return [];

  // Grouped by bucket because the rows are not all in one: the staff videos
  // are in training-videos and the overview sits in marketing.
  // createSignedUrls is per-bucket, so signing them in a single call would
  // have quietly failed for whichever bucket lost.
  const byBucket = new Map<string, string[]>();
  for (const r of rows) {
    const paths = byBucket.get(r.bucket) ?? [];
    paths.push(r.storage_path);
    if (r.caption_path) paths.push(r.caption_path);
    byBucket.set(r.bucket, paths);
  }

  const signed = new Map<string, string>();
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      if (paths.length === 0) return;
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      for (const s of data ?? []) {
        // Keyed by bucket too -- two buckets can hold the same path name.
        if (s.path && s.signedUrl) signed.set(`${bucket}/${s.path}`, s.signedUrl);
      }
    })
  );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    titleEn: r.title_en,
    titleEs: r.title_es,
    descriptionEn: r.description_en,
    descriptionEs: r.description_es,
    durationSeconds: r.duration_seconds,
    href: HREF_BY_SLUG[r.slug] ? HREF_BY_SLUG[r.slug](propertyId) : null,
    signedUrl: signed.get(`${r.bucket}/${r.storage_path}`) ?? null,
    captionSignedUrl: r.caption_path ? signed.get(`${r.bucket}/${r.caption_path}`) ?? null : null,
  }));
}
