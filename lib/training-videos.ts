// lib/training-videos.ts
// The training series, in the order staff should watch it.
//
// Deliberately a static ordered list rather than a database table: there are
// six fixed onboarding videos, the order is editorial, and a table would add
// a migration, RLS, and an admin surface for something nobody needs to edit
// at runtime. If they ever become per-property or user-managed, that's the
// point to move them into the database, not before.
//
// Objects live in the PRIVATE `training-videos` bucket and are reached only
// via short-lived signed URLs -- never a public URL. Verified live that the
// public-URL path returns 400 for this bucket.
export type TrainingVideo = {
  /** Object path inside the training-videos bucket. */
  path: string;
  order: number;
  titleKey: string;
  /** Route this video is about, so a viewer can go straight there. */
  href?: (propertyId: string) => string;
  /**
   * Spanish caption track, as an object path in the SAME private
   * training-videos bucket (e.g. 'sp-02-dashboard_es.vtt'). Signed
   * alongside the video; absent means the player renders no <track> and
   * the English-only notice stays visible for that video.
   */
  captionPath?: string;
};

// Three of the six have Spanish captions as of 28 Jul 2026, uploaded to the
// same private bucket. The other three have none yet -- those videos keep
// showing the English-only notice, and adding a caption later is still just
// one more captionPath here.
export const TRAINING_VIDEOS: TrainingVideo[] = [
  { path: 'sp-01-welcome.mp4', order: 1, titleKey: 'v1', captionPath: 'sp-01-welcome_es.vtt' },
  {
    path: 'sp-02-dashboard.mp4',
    order: 2,
    titleKey: 'v2',
    href: (p) => `/properties/${p}/dashboard`,
    captionPath: 'sp-02-dashboard_es.vtt',
  },
  { path: 'sp-03-inventory.mp4', order: 3, titleKey: 'v3', href: (p) => `/properties/${p}/inventory` },
  { path: 'sp-04-shopping-lists.mp4', order: 4, titleKey: 'v4', href: (p) => `/properties/${p}/shopping-list` },
  { path: 'sp-05-recipes-meal-planning.mp4', order: 5, titleKey: 'v5', href: (p) => `/properties/${p}/recipes` },
  {
    path: 'sp-06-staff-my-day.mp4',
    order: 6,
    titleKey: 'v6',
    href: (p) => `/properties/${p}/my-day`,
    captionPath: 'sp-06-staff-my-day_es.vtt',
  },
];

export const MY_DAY_VIDEO_PATH = 'sp-06-staff-my-day.mp4';

/** One hour: long enough to watch a short video, short enough that a copied
 *  URL is not a lasting credential. */
export const SIGNED_URL_TTL_SECONDS = 3600;
