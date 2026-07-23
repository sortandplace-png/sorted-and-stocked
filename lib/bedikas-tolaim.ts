// lib/bedikas-tolaim.ts
// Keyword match against a fixed, real list of produce commonly requiring
// bug-checking under standard kosher practice (leafy greens, cruciferous
// vegetables, bunched herbs, sprouts/microgreens, some berries). Ingredient
// names are free text (confirmed live -- no controlled vocabulary), so this
// is necessarily a heuristic, not an exhaustive halachic ruling -- same
// "confirm your household's usual approach" framing as the note text below,
// reused verbatim from tonight's produce inventory notes for consistency.
const BEDIKAS_TOLAIM_KEYWORDS = [
  'lettuce', 'romaine', 'spinach', 'kale', 'arugula', 'endive', 'watercress',
  'parsley', 'dill', 'cilantro', 'basil', 'mint', 'chives', 'thyme', 'rosemary',
  'broccoli', 'cauliflower', 'brussels sprout', 'cabbage', 'asparagus',
  'artichoke', 'scallion', 'leek', 'fennel',
  'strawberr', 'raspberr', 'blackberr', 'fig',
  'sprout', 'microgreen',
];

// Dried/powdered/jarred/well-processed forms are commonly treated as exempt
// under standard practice -- a "check your dill dressing for bugs" note
// would be noise, not a real reminder (confirmed against real recipe data:
// "Parve garlic dill dressing" and "marinated artichoke hearts, drained"
// both matched before these were added). Frozen isn't excluded: freezing
// alone doesn't resolve inspection status the way drying/processing does.
const EXEMPT_FORM_KEYWORDS = [
  'dried', 'powder', 'flakes', 'dressing', 'sauce', 'marinated', 'jarred', 'canned', 'pickled',
];

export const BEDIKAS_TOLAIM_NOTE =
  "Commonly requires careful inspection or certified pre-checked sourcing per standard kosher practice — confirm your household's usual approach";

export function needsBedikasTolaim(ingredientName: string): boolean {
  const lower = ingredientName.toLowerCase();
  if (EXEMPT_FORM_KEYWORDS.some((kw) => lower.includes(kw))) return false;
  return BEDIKAS_TOLAIM_KEYWORDS.some((kw) => lower.includes(kw));
}

// Distinct matching ingredient names from a recipe's ingredient list, for
// display (e.g. "Romaine lettuce, Fresh dill need inspection").
export function bedikasTolaimIngredients(ingredientNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of ingredientNames) {
    if (needsBedikasTolaim(name) && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
