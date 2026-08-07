// lib/get-next-observance.ts
// Extracted from app/properties/[id]/layout.tsx so the header countdown
// pill and the Dashboard Widgets "Shabbos/Yom Tov Countdown" card read the
// exact same logic instead of two engines that could drift apart.
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
//
// Real bug found and fixed, not assumed, same family as every other date
// bug found tonight: format(new Date(), ...) with no timeZone reads the
// server runtime's own local time -- Vercel defaults to UTC, not Eastern --
// so on any Eastern evening at/after 8pm (EDT, UTC-4) this header pill
// (shown on every page, not just the Dashboard) was already querying from
// TOMORROW's date, capable of skipping past an observance that starts
// today or briefly showing one day less "until" than real. Anchored to the
// real Eastern calendar date instead.
export async function getNextObservance(): Promise<UpcomingObservance | null> {
  const supabase = await createClient();
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const eastMap = Object.fromEntries(eastern.map((p) => [p.type, p.value]));
  const todayStr = `${eastMap.year}-${eastMap.month}-${eastMap.day}`;
  // SS-479. yom_tov_dates is superseded (migration 220) -- computed via
  // jewish_calendar_dates now. The RPC needs both bounds, unlike the old
  // open-ended .gte(); one year out is far more than enough to always
  // contain the next real occasion. Rosh Chodesh/Chanukah/Purim excluded
  // -- yom_tov_dates never had them, and "next observance" here means
  // Yom Tov specifically, same scope as before this swap.
  const oneYearOut = new Date(`${todayStr}T00:00:00Z`);
  oneYearOut.setUTCFullYear(oneYearOut.getUTCFullYear() + 1);
  const oneYearOutStr = oneYearOut.toISOString().slice(0, 10);
  const [{ data: yomTovRows }, { data: fastRows }] = await Promise.all([
    supabase
      .rpc('jewish_calendar_dates', { p_from: todayStr, p_to: oneYearOutStr })
      .not('holiday_name', 'like', 'Rosh Chodesh%')
      .not('holiday_name', 'like', 'Chanukah%')
      .not('holiday_name', 'ilike', '%purim%')
      .order('date'),
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
