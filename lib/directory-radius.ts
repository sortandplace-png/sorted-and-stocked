// lib/directory-radius.ts
// Locality rule for the Local Takeout Directory. Density decides reach:
// a house in a dense metro keeps a tight 5-mile default (plenty of
// options close by); a rural house widens to 25 miles or its list
// filters itself to nothing -- Country (Mountain Dale NY 12763) is the
// motivating case.
//
// No geocoding dependency: with only zips on both sides, distance is
// approximated by zip structure, and the approximation is deliberately
// PERMISSIVE -- this filter exists to keep a dense-metro list from
// drowning in far-away entries, never to hide a curated row someone
// added on purpose. Rows with no zip and no city at all always show:
// they were hand-entered for this property and the curator outranks the
// heuristic.
//   5 mi  (dense): same 5-digit zip, or same city name.
//   25 mi (wide):  same 3-digit zip prefix (a USPS sectional center --
//                  a reasonable wide-area proxy), or same city/state.

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
  row: { zip?: string | null; city?: string | null; state?: string | null }
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

  const radius = directoryRadiusMiles(propZip);
  if (propCity && rowCity && propCity === rowCity) return true;
  if (propZip && rowZip) {
    if (radius === 5) return rowZip === propZip;
    return rowZip.slice(0, 3) === propZip.slice(0, 3);
  }
  // One side has only a city, the other only a zip -- not comparable;
  // stay permissive for the same reason as above.
  return true;
}
