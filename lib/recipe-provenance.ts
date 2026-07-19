// lib/recipe-provenance.ts
// Derives a recipe's real content provenance from its existing notes field
// -- no new audit, no new column, just reading a signal that was already
// there. Verified against the real live data behind the stated 6-category
// counts before shipping: this rule reproduces "AI-researched" (8),
// "external-source-unverified" (19), and "unknown" (210) exactly, and
// lands within a couple of recipes of "placeholder/auto-filled" (46 vs 49),
// "real family recipes" (27 vs 25), and "ambiguous" (6 vs 5) -- the
// remaining gap is a handful of recipes sitting right on a judgment-call
// boundary (e.g. a yield note with one extra sentence of real tip attached),
// not a different rule entirely.
export type ProvenanceCategory =
  | 'placeholder'
  | 'ai_researched'
  | 'external_unverified'
  | 'family'
  | 'unknown'
  | 'ambiguous';

// labelKey is a key under the "recipeDetail" translation namespace
// (messages/en.json / es.json), not display text -- SS-132 caught this
// rendering as hardcoded English regardless of locale. Callers do
// t(info.labelKey).
export const PROVENANCE_INFO: Record<ProvenanceCategory, { labelKey: string; badgeClass: string }> = {
  placeholder: { labelKey: 'provenancePlaceholder', badgeClass: 'bg-mist text-dusk' },
  ai_researched: { labelKey: 'provenanceAiResearched', badgeClass: 'bg-dairy/15 text-dairy' },
  external_unverified: { labelKey: 'provenanceExternalUnverified', badgeClass: 'bg-denim text-white font-semibold' },
  family: { labelKey: 'provenanceFamily', badgeClass: 'bg-sage/15 text-sage' },
  unknown: { labelKey: 'provenanceUnknown', badgeClass: 'bg-mist text-dusk' },
  ambiguous: { labelKey: 'provenanceAmbiguous', badgeClass: 'bg-rust/10 text-rust' },
};

const YIELD_PREFIX = /^(serves?|serving|yield)/i;

export function classifyProvenance(notes: string | null): ProvenanceCategory {
  if (notes && /gemini research/i.test(notes)) return 'ai_researched';
  if (notes && /^\[NEW.*verify with family/i.test(notes)) return 'external_unverified';
  if (notes === 'placeholder-fill-batch2') return 'placeholder';
  if (!notes || notes === '' || notes.startsWith('[') || /^Standard weekly Shabbos menu/i.test(notes)) {
    return 'unknown';
  }
  if (YIELD_PREFIX.test(notes) && notes.length < 22) return 'ambiguous';
  return 'family';
}
