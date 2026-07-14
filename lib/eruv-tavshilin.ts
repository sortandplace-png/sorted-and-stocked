// lib/eruv-tavshilin.ts
// Eruv Tavshilin is only needed when a 2-day Yom Tov falls Thu-Fri (cooking
// for Shabbos would otherwise be forbidden on the Yom Tov day before it) --
// a rare enough occurrence that a small real, verified list is safer than
// re-deriving the Hebrew-calendar logic here. Real dates confirmed against
// the Hebrew calendar for the current Sorted & Stocked planning window:
// - Shmini Atzeret 2026: eruv Thu Oct 1 2026 (Shmini Atzeret falls Fri/Sat)
// - Pesach 2027: eruv Wed Apr 21 2027 (2-day Yom Tov block, eruv must
//   predate the whole block, not just the first day)
// - Shavuot 2027: eruv Thu Jun 10 2027
// Sukkot 2026 genuinely does NOT need one (Sukkot I/II fall Sat/Sun).
export interface EruvTavshilinDate {
  eruvDate: string; // YYYY-MM-DD, the day the eruv must be made
  holidayName: string;
}

const ERUV_TAVSHILIN_DATES: EruvTavshilinDate[] = [
  { eruvDate: '2026-10-01', holidayName: 'Shmini Atzeret' },
  { eruvDate: '2027-04-21', holidayName: 'Pesach' },
  { eruvDate: '2027-06-10', holidayName: 'Shavuot' },
];

// Shows starting a week before the eruv date through the eruv date itself --
// same reminder window feel as the Prep Reminders card elsewhere on this
// page, not a same-day-only alert someone could easily miss.
const REMINDER_WINDOW_DAYS = 7;

export function getUpcomingEruvTavshilin(today: Date): EruvTavshilinDate | null {
  const todayStr = today.toISOString().slice(0, 10);
  for (const entry of ERUV_TAVSHILIN_DATES) {
    const daysUntil = Math.round(
      (new Date(entry.eruvDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysUntil >= 0 && daysUntil <= REMINDER_WINDOW_DAYS) {
      return entry;
    }
  }
  return null;
}
