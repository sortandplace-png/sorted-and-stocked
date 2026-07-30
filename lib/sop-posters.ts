// lib/sop-posters.ts
// SS-363: sop-posters is a private bucket now, so a poster can no longer be
// shown by rewriting a public URL (storageThumbnail's approach, still
// correct for buckets that stay public) -- it needs a signed URL, and
// unlike training-videos' one-URL-per-file, SopLibraryClient shows the SAME
// poster at three different sizes (tile thumbnail, expanded-card detail,
// full-size lightbox), each needing its own signed+transformed URL, since a
// transform is baked into the signature and can't be appended after the
// fact the way storageThumbnail appends query params to a public URL.
//
// createSignedUrl (singular) is the only method in this SDK version whose
// types support a `transform` option -- createSignedUrls (plural, batch)
// does not (confirmed against node_modules/@supabase/storage-js's actual
// source, not assumed from the docs). So this signs individually per path
// per size tier rather than in three batched calls; all requests still run
// in parallel via Promise.all, so it's still one network "round" regardless
// of how many posters exist, just more individual requests within it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { storagePathFromPublicUrl } from '@/lib/storage-image';

const BUCKET = 'sop-posters';
const SIGNED_URL_TTL_SECONDS = 3600;

export type SignedPoster = { thumbUrl: string | null; detailUrl: string | null; fullUrl: string | null };

async function signOne(
  supabase: SupabaseClient,
  path: string,
  transform?: { width: number; height: number; resize: 'contain'; quality: number }
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, transform ? { transform } : undefined);
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
      const [thumbUrl, detailUrl, fullUrl] = await Promise.all([
        signOne(supabase, path, { width: 160, height: 160, resize: 'contain', quality: 70 }),
        signOne(supabase, path, { width: 640, height: 640, resize: 'contain', quality: 70 }),
        // No transform -- the lightbox is the one place full size is the
        // point (matches the original public-URL behavior it replaces).
        signOne(supabase, path),
      ]);
      result.set(originalUrl, { thumbUrl, detailUrl, fullUrl });
    })
  );

  return result;
}
