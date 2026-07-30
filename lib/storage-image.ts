// lib/storage-image.ts
// Supabase Storage serves two URL shapes for a public object:
//
//   /storage/v1/object/public/<bucket>/<path>          the original file
//   /storage/v1/render/image/public/<bucket>/<path>    resized on the fly
//
// The stored URLs are all the first kind, which is correct for anything
// shown at full size and badly wrong for a thumbnail. The SOP posters are
// ~800KB JPEGs; a task list rendering 43 of them into 44px squares would
// pull tens of megabytes to draw postage stamps, on staff phones, most
// likely on mobile data. Measured on SOP-047: 803,021 bytes as stored,
// 3,488 bytes through the render endpoint at 88px -- about 230x smaller.
//
// Transformation is a paid Supabase feature; confirmed live on this project
// (the render URL above returns 200 image/jpeg, not 400).

/**
 * Rewrite a public Supabase Storage URL to its resizing endpoint.
 *
 * `size` is the pixel box the image is fitted into -- pass roughly twice
 * the CSS size so it stays sharp on a 2x phone screen.
 *
 * `resize` defaults to 'cover', which crops to fill -- right for the square
 * thumbnails on task tiles, wrong for anything read rather than glanced at.
 * Pass 'contain' for a poster shown at reading size: it fits inside the box
 * with the aspect ratio intact, so no instruction gets cropped off an edge.
 *
 * Anything that is not a public Supabase object URL is returned untouched,
 * so this is safe to apply to a column that might hold an external link:
 * the worst case is the original URL, which is what it does today.
 */
export function storageThumbnail(
  url: string,
  size: number,
  resize: 'cover' | 'contain' = 'cover'
): string {
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return url;
  // An existing query string would collide with the transform params, and
  // signed/download URLs are not our shape anyway -- leave those alone.
  if (url.includes('?')) return url;
  const rendered = url.replace(marker, '/storage/v1/render/image/public/');
  return `${rendered}?width=${size}&height=${size}&resize=${resize}&quality=70`;
}

/**
 * Extract the bare storage path out of a stored "public-style" object URL,
 * for a bucket that has since gone private (SS-363).
 *
 * `expected_appearance_url` and similar columns still hold URLs shaped like
 * .../object/public/<bucket>/<path> from when the bucket was public -- that
 * exact string no longer resolves once public=false, but it still reliably
 * encodes the real path, so treating it as a path-carrying convention
 * (rather than backfilling every row to a bare-path format) is the lower-risk
 * change. Returns null for anything not shaped like this bucket's URLs --
 * callers should treat that as "no image", not throw.
 */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}
