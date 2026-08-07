// lib/recipe-new-badge.ts
// SS-450: ONE definition of "shows the NEW badge" (tonight's low-stock
// lesson applied preemptively). A recipe is new while today is on or
// before its new_badge_until date -- null or past means no badge, so the
// badge expires by itself and clearing is setting the column null.
import { getEasternDateStr } from '@/lib/eastern-weekday';

// SS-208. Was new Date().toISOString().slice(0,10) -- the UTC date, which
// from roughly 8pm Eastern reads as tomorrow, dropping the badge one
// evening early on its last real day.
export function showsNewBadge(r: { new_badge_until?: string | null }): boolean {
  if (!r.new_badge_until) return false;
  return getEasternDateStr(new Date()) <= r.new_badge_until;
}
