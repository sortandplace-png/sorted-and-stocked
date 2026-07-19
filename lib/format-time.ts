// lib/format-time.ts
// Recipes with long unattended cook times (cholent, slow-braised brisket)
// were showing as "600 min" -- accurate but unreadable. Anything over an
// hour now reads as hours (+ minutes if not a round hour); under an hour
// stays as plain minutes, unchanged.
//
// locale defaults to 'en' so every existing call site keeps working
// unchanged -- only callers that actually have a locale in scope (and
// need it, like RecipeDetailClient's ES view) pass one.
export function formatMinutes(totalMinutes: number, locale: 'en' | 'es' = 'en'): string {
  const unit = locale === 'es' ? { min: 'min', hr: 'h' } : { min: 'min', hr: 'hr' };
  if (totalMinutes < 60) return `${totalMinutes} ${unit.min}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} ${unit.hr}` : `${hours} ${unit.hr} ${minutes} ${unit.min}`;
}
