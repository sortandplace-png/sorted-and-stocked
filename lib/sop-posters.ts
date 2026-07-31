// lib/sop-posters.ts
// SS-363: sop-posters is a private bucket, so a poster needs a signed URL.
//
// SS-451 (31 Jul): the per-size signed TRANSFORMS this file used to mint
// (160px thumb / 640px detail / full) are gone -- signed transforms bill
// on the metered image-transformation feature Racquel ruled off. One
// plain signed URL per poster now serves every tier; the SignedPoster
// shape is kept so SopLibraryClient's three mounting points don't churn,
// and so pre-sized assets can slot back into the tiers later if the
// full-size-bytes cost ever bites.
import type { SupabaseClient } from '@supabase/supabase-js';
import { storagePathFromPublicUrl } from '@/lib/storage-image';

const BUCKET = 'sop-posters';
const SIGNED_URL_TTL_SECONDS = 3600;

export type SignedPoster = { thumbUrl: string | null; detailUrl: string | null; fullUrl: string | null };

async function signOne(supabase: SupabaseClient, path: string): Promise<string | null> {
  // SS-451: no `transform` option, ever -- signed transforms bill on the
  // same metered image-transformation feature Racquel ruled off. One plain
  // signed URL per object; the three size tiers below all reuse it and the
  // browser scales it down.
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Sign every poster URL in `urls` at three sizes. Returns a map keyed by the
 * ORIGINAL stored URL string (not the bare path), so callers can look a
 * poster up by the same value they already have on hand without re-deriving
 * the path themselves.
 */
export async function signSopPosters(
  supabase: SupabaseClient,
  urls: (string | null)[]
): Promise<Map<string, SignedPoster>> {
  const byPath = new Map<string, string>(); // path -> original stored URL
  for (const url of urls) {
    if (!url) continue;
    const path = storagePathFromPublicUrl(url, BUCKET);
    if (path) byPath.set(path, url);
  }
  const result = new Map<string, SignedPoster>();
  if (byPath.size === 0) return result;

  await Promise.all(
    [...byPath.entries()].map(async ([path, originalUrl]) => {
      // SS-451: one untransformed signed URL serves all three tiers.
      const url = await signOne(supabase, path);
      result.set(originalUrl, { thumbUrl: url, detailUrl: url, fullUrl: url });
    })
  );

  return result;
}
