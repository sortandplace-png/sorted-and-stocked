// lib/zip-distance.ts
// Real miles between two US zips -- replaces lib/directory-radius.ts's
// zip-prefix structural proxy (directed 1 Aug: static centroid lookup,
// no external API, no keys, works offline).
//
// SERVER-ONLY. The dataset is the `us-zips` npm package (MIT): 33,791
// ZIP -> centroid pairs generated from the US Census Bureau's public
// domain ZCTA gazetteer, bundled at build time -- ~1.5 MB of data that
// must never ride into a client bundle, which is why the client goes
// through /api/zip-distance instead of importing this.
import usZips from 'us-zips';

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** First five digits, so ZIP+4 entries ("08701-1234") still resolve. */
function normalizeZip(zip: string | null | undefined): string | null {
  const five = (zip ?? '').trim().slice(0, 5);
  return /^\d{5}$/.test(five) ? five : null;
}

export function zipCentroid(zip: string | null | undefined): { latitude: number; longitude: number } | null {
  const five = normalizeZip(zip);
  return five ? (usZips as Record<string, { latitude: number; longitude: number }>)[five] ?? null : null;
}

/** Centroid-to-centroid distance in miles, or null when either zip is
 *  missing from the ZCTA table (PO-box-only zips mostly) -- callers
 *  treat null as "unmeasurable", never as "far away". */
export function distanceMilesBetweenZips(zipA: string | null | undefined, zipB: string | null | undefined): number | null {
  const a = zipCentroid(zipA);
  const b = zipCentroid(zipB);
  if (!a || !b) return null;
  return haversineMiles(a, b);
}
