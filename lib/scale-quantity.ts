// lib/scale-quantity.ts
// Kitchen-friendly fraction display — nobody wants to measure "0.33 cups."
// Rounds to the nearest 1/4 (close enough for cooking) and renders common
// fractions as glyphs; falls back to a decimal for anything unusual.
const FRACTION_GLYPHS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
  '0.33': '⅓',
  '0.67': '⅔',
};

export function formatScaledNumber(n: number): string {
  const rounded = Math.round(n * 4) / 4; // nearest quarter
  const whole = Math.floor(rounded);
  const frac = +(rounded - whole).toFixed(2);
  if (frac === 0) return String(whole);
  const glyph = FRACTION_GLYPHS[frac.toFixed(2)];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
