// lib/storage-image.ts
// SS-451 (ruled 31 Jul, option A): Supabase's on-the-fly image
// transformation (/storage/v1/render/image/...) is a METERED paid feature
// and the meter must stop counting. This helper used to rewrite public
// object URLs onto that endpoint; it now returns the original object URL
// untouched.
//
// The function deliberately KEEPS its signature and stays mounted at every
// call site: it is the single seam through which any future pre-sized
// assets (real thumbnail files generated at upload time) would be wired
// back in -- one file changes, not nine call sites.
//
// Known, accepted cost of the ruling: originals serve at full size, so a
// task list drawing ~800KB posters into 44px squares pulls the full bytes
// again (measured before: 803,021 bytes original vs 3,488 through the
// transformer at 88px). If that bites on staff phones, the fix is
// pre-sized assets, never the render endpoint.

/** SS-451: passthrough. `size`/`resize` are ignored (kept so call sites,
 *  and any future pre-sized wiring, don't churn). */
export function storageThumbnail(
  url: string,
  _size?: number,
  _resize?: 'cover' | 'contain'
): string {
  return url;
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
