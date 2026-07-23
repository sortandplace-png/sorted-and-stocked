// lib/yom-tov.ts
// Groups the flat yom_tov_dates table (date, holiday_name) into real
// distinct occasions, so a multi-day chag (Rosh Hashana I/II, Sukkot I/II)
// counts down to its first day once instead of restarting per sub-day.
//
// Real data confirmed inconsistent in spots -- some years carry an extra
// duplicate leading row the next year's same chag doesn't have (e.g. 2026
// has "Yom Kippur eve/day" the day before "Yom Kippur"; 2027's Yom Kippur
// is a single row). Rather than assume a clean one-row-per-day-number
// shape and special-case each holiday, this groups by date-adjacency +
// a normalized base name -- it degrades gracefully against that real
// inconsistency instead of requiring the source data to be perfectly clean,
// and naturally keeps Pesach's first days (I/II) and last days (VII/VIII)
// as two separate occasions since Chol Hamoed sits between them and breaks
// the adjacency run.
//
// No Hebcal/candle-lighting calls here -- yom_tov_dates already has the
// dates; this is pure date math, not a second date engine.
//
// Replaces the earlier lib/eruv-tavshilin.ts, which hardcoded specific
// 2026/2027 dates -- this computes the same thing generally from real
// table data, so it never needs updating for a new year.

export type YomTovRow = { date: string; holiday_name: string };
export type YomTovOccasion = { name: string; date: string; daysUntil: number };
export type EruvTavshilinAlert = {
  name: string;
  eruvDate: string;
  yomTovStartDate: string;
  daysUntil: number;
};

const TRAILING_QUALIFIER = /\s+(eve\/day|I{1,3}|IV|VI{0,3}|\d{1,4})$/i;

function baseName(name: string): string {
  return name.replace(TRAILING_QUALIFIER, '').trim();
}

export function daysBetween(aIso: string, bIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(`${bIso}T00:00:00Z`).getTime() - new Date(`${aIso}T00:00:00Z`).getTime()) / msPerDay
  );
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isFridayIso(iso: string): boolean {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 5;
}

// Chol Hamoed / Hoshana Rabbah are real calendar entries but not Yom Tov
// proper -- excluded from the "upcoming Yom Tov" list so 2-3 real yamim
// tovim show, not diluted by intermediate days.
function isRealYomTov(name: string): boolean {
  return !/^chol hamoed/i.test(name) && !/^hoshana rabbah$/i.test(name);
}

// Shared by groupYomTovOccasions and getUpcomingEruvTavshilin -- one real
// clustering pass, not two competing implementations of the same grouping.
// Keeps every date in the cluster (not just the first) since Eruv Tavshilin
// needs to know whether ANY day in the span is a Friday, not just day one.
function clusterOccasions(rows: YomTovRow[]): { name: string; dates: string[] }[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const clusters: { name: string; dates: string[] }[] = [];
  let lastDate: string | null = null;
  let lastBase: string | null = null;

  for (const row of sorted) {
    const base = baseName(row.holiday_name);
    const isAdjacent = lastDate !== null && daysBetween(lastDate, row.date) <= 1;

    if (isAdjacent && base === lastBase) {
      clusters[clusters.length - 1].dates.push(row.date);
    } else {
      // Pesach's concluding days (VII/VIII) share a base name with its
      // first days but are a genuinely separate occasion once Chol Hamoed
      // has broken the adjacency run -- label distinctly so "Pesach"
      // doesn't appear to repeat unexplained in the upcoming list.
      const isConcluding = /\s+(VII|VIII)$/i.test(row.holiday_name);
      clusters.push({ name: isConcluding ? `${base} (concluding days)` : base, dates: [row.date] });
    }
    lastDate = row.date;
    lastBase = base;
  }

  return clusters;
}

export function groupYomTovOccasions(rows: YomTovRow[], todayIso: string): YomTovOccasion[] {
  return clusterOccasions(rows)
    .map((c) => ({ name: c.name, date: c.dates[0] }))
    .filter((c) => c.date >= todayIso && isRealYomTov(c.name))
    .map((c) => ({ name: c.name, date: c.date, daysUntil: daysBetween(todayIso, c.date) }));
}

// Eruv Tavshilin is needed only when a real Yom Tov day immediately
// precedes Shabbos -- i.e. any day in the occasion's span falls on Friday.
// It must be made on Erev Yom Tov, the day before the WHOLE occasion
// begins (cluster start - 1), not "the day before Friday" -- those are the
// same date only when Friday is itself day one. For a 2-day Yom Tov
// starting Thursday (Friday is day two), the eruv still has to be made
// Wednesday, since once Yom Tov begins there's no making it anymore.
// Yom Kippur is deliberately excluded -- no cooking happens there at all,
// eruv or not, so the concept doesn't apply regardless of what day it falls.
export function getUpcomingEruvTavshilin(rows: YomTovRow[], todayIso: string): EruvTavshilinAlert[] {
  return clusterOccasions(rows)
    .filter((c) => isRealYomTov(c.name) && !/^yom kippur/i.test(c.name))
    .filter((c) => c.dates.some(isFridayIso))
    .map((c) => {
      const yomTovStartDate = c.dates[0];
      const eruvDate = addDays(yomTovStartDate, -1);
      return { name: c.name, eruvDate, yomTovStartDate, daysUntil: daysBetween(todayIso, eruvDate) };
    })
    .filter((a) => a.eruvDate >= todayIso);
}
