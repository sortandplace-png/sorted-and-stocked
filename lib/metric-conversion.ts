// lib/metric-conversion.ts
// Approximate gram equivalent shown alongside existing US units (never
// replacing them). Deliberately approximate -- actual weight per cup/tbsp
// varies with how packed/sifted an ingredient is, so this is a kitchen
// estimate, not a lab measurement. Returns null (nothing shown) when the
// unit isn't volume/weight-convertible or the ingredient's density can't
// be confidently inferred from its name, rather than guessing.
const ML_PER_UNIT: Record<string, number> = {
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  'fl oz': 30,
  pint: 473,
  quart: 946,
};

const OZ_TO_G = 28.35;
const LB_TO_G = 453.6;

// Grams per ml by ingredient keyword, checked in order -- first match wins,
// so more specific patterns (brown sugar) are listed before general ones
// (sugar).
const DENSITY_BY_KEYWORD: [RegExp, number][] = [
  [/flour/i, 0.53],
  [/brown sugar/i, 0.9],
  [/sugar/i, 0.85],
  [/butter/i, 0.96],
  [/\boil\b/i, 0.92],
  [/honey/i, 1.42],
  [/milk/i, 1.03],
  [/water/i, 1.0],
  [/\bsalt\b/i, 1.2],
  [/cocoa/i, 0.5],
  [/chocolate chip/i, 0.6],
  [/breadcrumb/i, 0.45],
  [/\brice\b/i, 0.85],
  [/\boats?\b/i, 0.41],
  [/shredded cheese|grated cheese/i, 0.4],
];

export function approxGrams(quantity: number, unit: string | null, name: string): number | null {
  if (!unit || !Number.isFinite(quantity) || quantity <= 0) return null;
  const u = unit.toLowerCase().trim();

  if (u === 'oz' || u === 'ounce' || u === 'ounces') return Math.round(quantity * OZ_TO_G);
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return Math.round(quantity * LB_TO_G);

  const ml = ML_PER_UNIT[u];
  if (!ml) return null;

  const density = DENSITY_BY_KEYWORD.find(([re]) => re.test(name))?.[1];
  if (!density) return null;

  return Math.round(quantity * ml * density);
}
