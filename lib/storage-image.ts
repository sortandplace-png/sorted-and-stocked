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
 * Anything that is not a public Supabase object URL is returned untouched,
 * so this is safe to apply to a column that might hold an external link:
 * the worst case is the original URL, which is what it does today.
 */
export function storageThumbnail(url: string, size: number): string {
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return url;
  // An existing query string would collide with the transform params, and
  // signed/download URLs are not our shape anyway -- leave those alone.
  if (url.includes('?')) return url;
  const rendered = url.replace(marker, '/storage/v1/render/image/public/');
  return `${rendered}?width=${size}&height=${size}&resize=cover&quality=70`;
}
