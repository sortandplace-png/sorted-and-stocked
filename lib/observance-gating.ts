// lib/observance-gating.ts
// Observance gating: which Jewish-observance surfaces a property sees,
// keyed off the SAME per-property axis the calendar already uses --
// properties.calendar_layers (migration 167, SS-469). 'jewish' in the
// layers means the household keeps the full observance surface set;
// absent (Henderson, {civil}) means the neutral equivalents. No new
// column, no second "is this house Jewish" flag that could drift from
// the calendar's answer.
//
// AMENDED GATING TABLE (31 Jul 2026) -- supersedes the original draft in
// which Allergen Verification and Dietary Tagging were swap-replacements
// for Hechsher Verification and Kosher Type Tagging. They are now
// UNIVERSAL: every property gets them, always on. The kashrut pair is
// Jewish-only and shows IN ADDITION to them, not instead of them.
//
//   Candle Lighting        -> swap to Evening Anchor when not Jewish
//   Halachic Calendar      -> swap to Seasonal & Home Prep when not Jewish
//   Yom Tov Year View      -> swap to Year at a Glance when not Jewish
//   Hechsher Verification  -> Jewish-only, in addition to Allergen Verification
//   Kosher Type Tagging    -> Jewish-only, in addition to Dietary Tagging
//   Allergen Verification  -> everyone
//   Dietary Tagging        -> everyone
//   Translation Worklist   -> everyone (unchanged)
//
// COLOR RESERVATION: the kashrut tokens rust #B5636B / dairy #4A6B8A /
// sage #8CA085 stay reserved for Meat/Dairy/Parve only. Allergen and
// dietary tags carry their own token set drawn from the Concept B
// palette (allergenTag/dietaryTag in tailwind.config.ts) -- never the
// kashrut three.

/** Same default as every other calendar_layers read (migration 167's
 *  column default is {jewish,civil}): an absent/null value means the full
 *  observance surface stays on, so no existing property changes behavior
 *  until someone explicitly sets a civil-only layer set. */
export function isJewishObservant(calendarLayers: string[] | null | undefined): boolean {
  return (calendarLayers ?? ['jewish', 'civil']).includes('jewish');
}

export type ToolTile = { slug: string; icon: string; title: string; description: string; count?: number };

/** Tools that exist ONLY on Jewish-observant properties. They are
 *  additions on top of the universal pair (Allergen Verification,
 *  Dietary Tagging), not the thing the universal pair replaces. */
export const JEWISH_ONLY_TOOL_SLUGS = ['hechsher-verification', 'kosher-type-tagging'] as const;

/** Swap-replacements: on a non-Jewish property the tile in the same grid
 *  position becomes its neutral equivalent. Keyed by the observant slug.
 *  yom-tov-year-view keeps its route (the page already strips the jewish
 *  rows for a civil-only house at the data edge -- see
 *  app/properties/[id]/tools/yom-tov-year-view/page.tsx); only the tile
 *  and in-page title change. halachic-calendar swaps to a genuinely
 *  different modal (SeasonalHomePrepClient) because its content is
 *  entirely observance-specific. */
export const OBSERVANCE_TOOL_SWAPS: Record<string, ToolTile> = {
  'halachic-calendar': {
    slug: 'seasonal-home-prep',
    icon: '📅',
    title: 'Seasonal & Home Prep',
    description: 'Where the year stands, and what the house should be getting ready for.',
  },
  'yom-tov-year-view': {
    // Same route as the observant tile -- the page renders civil-only for
    // a house without the jewish layer, which IS the Year at a Glance.
    slug: 'yom-tov-year-view',
    icon: '🗓️',
    title: 'Year at a Glance',
    description: 'Every holiday on the calendar, at a glance.',
  },
};

/** Resolve one tool tile for a property's observance. Returns null when
 *  the tile is Jewish-only and the property is not, the swapped neutral
 *  tile when one is defined, and the tile untouched otherwise. */
export function resolveToolForObservance(tile: ToolTile, jewish: boolean): ToolTile | null {
  if (jewish) return tile;
  if ((JEWISH_ONLY_TOOL_SLUGS as readonly string[]).includes(tile.slug)) return null;
  return OBSERVANCE_TOOL_SWAPS[tile.slug] ?? tile;
}
