// lib/get-next-observance.ts
// Extracted from app/properties/[id]/layout.tsx so the header countdown
// pill and the Dashboard Widgets "Shabbos/Yom Tov Countdown" card read the
// exact same logic instead of two engines that could drift apart.
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { groupYomTovOccasions, daysBetween } from '@/lib/yom-tov';

export type UpcomingObservance = { name: string; date: string; daysUntil: number };

// yom_tov_dates and fast_days both have no property_id -- same shared
// calendar tables serve every property.
//
// Merges both sources rather than showing Yom Tov only -- a minor fast like
// Tzom Tammuz or Tish'a B'Av is very often the actually-nearest observance.
// Yom Kippur is a real row in BOTH tables (it's both a Yom Tov and a major
// fast) -- deduped by date after sorting so it surfaces once.
export async function getNextObservance(): Promise<UpcomingObservance | null> {
  const supabase = await createClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [{ data: yomTovRows }, { data: fastRows }] = await Promise.all([
    supabase.from('yom_tov_dates').select('date, holiday_name').gte('date', todayStr).order('date'),
    supabase.from('fast_days').select('date, holiday_name').gte('date', todayStr).order('date'),
  ]);

  const yomTovOccasions = groupYomTovOccasions(yomTovRows || [], todayStr);
  const fastOccasions: UpcomingObservance[] = (fastRows || []).map((r) => ({
    name: r.holiday_name,
    date: r.date,
    daysUntil: daysBetween(todayStr, r.date),
  }));

  const merged = [...yomTovOccasions, ...fastOccasions].sort((a, b) => a.date.localeCompare(b.date));
  const deduped: UpcomingObservance[] = [];
  for (const occ of merged) {
    if (deduped.length > 0 && deduped[deduped.length - 1].date === occ.date) continue;
    deduped.push(occ);
  }
  return deduped[0] ?? null;
}
