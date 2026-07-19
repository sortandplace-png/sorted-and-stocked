// lib/recipe-provenance.ts
// Derives a recipe's real content provenance from its existing notes field
// -- no new audit, no new column, just reading a signal that was already
// there. Standing rule: the app never displays "Unknown" -- a recipe with
// nothing meaningful in notes (null/empty/bracketed placeholder text) gets
// no badge at all, not a category. That used to be a real 'unknown' bucket
// (rendered as literal "Unknown"/"Desconocido" on ~102 of 319 recipes);
// classifyProvenance() now returns null for it instead, and callers render
// nothing when they get null.
export type ProvenanceCategory =
  | 'placeholder'
  | 'ai_researched'
  | 'external_unverified'
  | 'family'
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
  ambiguous: { labelKey: 'provenanceAmbiguous', badgeClass: 'bg-rust/10 text-rust' },
};

const YIELD_PREFIX = /^(serves?|serving|yield)/i;

// Standing rule: the app never displays "Unknown" -- nothing meaningful to
// say means no badge at all, not a placeholder word. null is the real
// "nothing to report" signal; callers render no badge when they get one
// (102 of 319 recipes today: 82 null notes + 20 empty -- confirmed live
// before changing this, not assumed from the old count in the comment
// above, which bundled in the 46 real placeholder-batch recipes that
// already get their own distinct, meaningful badge and are untouched here).
export function classifyProvenance(notes: string | null): ProvenanceCategory | null {
  if (notes && /gemini research/i.test(notes)) return 'ai_researched';
  if (notes && /^\[NEW.*verify with family/i.test(notes)) return 'external_unverified';
  if (notes === 'placeholder-fill-batch2') return 'placeholder';
  if (!notes || notes === '' || notes.startsWith('[') || /^Standard weekly Shabbos menu/i.test(notes)) {
    return null;
  }
  if (YIELD_PREFIX.test(notes) && notes.length < 22) return 'ambiguous';
  return 'family';
}
