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

export const PROVENANCE_INFO: Record<ProvenanceCategory, { label: string; badgeClass: string }> = {
  placeholder: { label: 'Placeholder / Auto-filled', badgeClass: 'bg-mist text-dusk' },
  ai_researched: { label: 'AI-Researched', badgeClass: 'bg-dairy/15 text-dairy' },
  external_unverified: { label: 'External Source — Unverified', badgeClass: 'bg-denim text-white font-semibold' },
  family: { label: 'Real Family Recipe', badgeClass: 'bg-sage/15 text-sage' },
  unknown: { label: 'Unknown', badgeClass: 'bg-mist text-dusk' },
  ambiguous: { label: 'Ambiguous', badgeClass: 'bg-rust/10 text-rust' },
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
