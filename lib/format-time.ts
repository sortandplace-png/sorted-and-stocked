// lib/format-time.ts
// Recipes with long unattended cook times (cholent, slow-braised brisket)
// were showing as "600 min" -- accurate but unreadable. Anything over an
// hour now reads as hours (+ minutes if not a round hour); under an hour
// stays as plain minutes, unchanged.
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}
