// lib/directory-radius.ts
// Locality rule for the Local Takeout Directory. Density decides reach:
// a house in a dense metro keeps a tight 5-mile default (plenty of
// options close by); a rural house widens to 25 miles or its list
// filters itself to nothing -- Country (Mountain Dale NY 12763) is the
// motivating case.
//
// Distance is REAL MILES now (directed 1 Aug, replacing this file's
// original zip-prefix structural proxy): haversine between US Census
// ZCTA zip centroids, served by /api/zip-distance from the server-only
// table in lib/zip-distance.ts -- static data, no external API, no keys,
// works offline. This filter still exists to keep a list local, never to
// hide a curated row: anything unmeasurable stays visible.
//   - Row with no zip and no city: always shows (the curator outranks
//     the rule).
//   - Property with no locality data of its own: everything shows
//     (Henderson today, SS-478).
//   - Same city name: shows without needing a centroid.
//   - Measurable distance: shows iff within the density radius.
//   - Zips present but centroid missing (PO-box-only zips) or distance
//     not yet loaded: shows -- unmeasurable is never "far away".

// 3-digit zip prefixes that count as dense metro. Includes the metros
// this app's real properties sit in today (Lakewood NJ 087, Henderson/
// Las Vegas NV 889-891, LA 900-913 for Lax) plus the obvious majors --
// a rural-NY 127xx zip like Country's is exactly what this list is NOT
// supposed to contain.
const DENSE_METRO_ZIP_PREFIXES = new Set([
  '070', '071', '072', '073', '074', '075', '076', '077', '087', // north/central NJ incl. Lakewood
  '100', '101', '102', '103', '104', '110', '111', '112', '113', '114', '116', // NYC boroughs + LI edge
  '191', // Philadelphia
  '206', '207', '208', '209', '220', '221', '222', '223', // DC metro
  '300', '301', '302', '303', // Atlanta
  '331', '332', '330', // Miami
  '440', '441', // Cleveland
  '606', '607', '608', // Chicago
  '750', '751', '752', // Dallas
  '770', '772', // Houston
  '852', '853', // Phoenix
  '889', '890', '891', // Las Vegas / Henderson
  '900', '901', '902', '903', '904', '905', '906', '907', '908', '910', '911', '912', '913', // LA
  '941', '940', // SF peninsula
]);

export function directoryRadiusMiles(zip: string | null | undefined): 5 | 25 {
  const prefix = (zip ?? '').trim().slice(0, 3);
  return DENSE_METRO_ZIP_PREFIXES.has(prefix) ? 5 : 25;
}

export function isWithinDirectoryRadius(
  property: { zip: string | null; city: string | null; state?: string | null },
  row: { zip?: string | null; city?: string | null; state?: string | null },
  // Real centroid miles between property.zip and row.zip, from
  // /api/zip-distance. null = looked up but unmeasurable; undefined =
  // not loaded (yet) -- both stay permissive.
  distanceMiles?: number | null
): boolean {
  const rowZip = row.zip?.trim() || null;
  const rowCity = row.city?.trim().toLowerCase() || null;
  // Hand-entered row with no locality data: the curator outranks the rule.
  if (!rowZip && !rowCity) return true;
  const propZip = property.zip?.trim() || null;
  const propCity = property.city?.trim().toLowerCase() || null;
  // A property with no locality data of its own can't measure anything --
  // show everything rather than blank the list (Henderson today, SS-478).
  if (!propZip && !propCity) return true;

  if (propCity && rowCity && propCity === rowCity) return true;
  if (typeof distanceMiles === 'number') {
    return distanceMiles <= directoryRadiusMiles(propZip);
  }
  // No measurable distance (missing zip on either side, PO-box-only zip,
  // or the lookup hasn't answered yet): stay permissive.
  return true;
}
