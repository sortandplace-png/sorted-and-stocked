// lib/us-holidays.ts
// SS-467: US federal holidays as PURE DATE RULES -- fixed dates plus
// nth-weekday rules. No API, no table, never expires, works for any year.
// Deliberately the ACTUAL statutory dates, not the "observed" Mon/Fri
// shifts (a home calendar answers "what day IS July 4th", not which day
// the post office closes); if observed dates are ever wanted, that is a
// second rule set, not an edit to these.
export type UsHoliday = { date: string; name_en: string; name_es: string };

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** nth (1-based) occurrence of weekday (0=Sun..6=Sat) in month m of year y. */
function nthWeekday(y: number, m: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
  return iso(y, m, day);
}

/** Last occurrence of weekday in month m of year y. */
function lastWeekday(y: number, m: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return iso(y, m, lastDay - ((lastDow - weekday + 7) % 7));
}

export function usFederalHolidays(year: number): UsHoliday[] {
  return [
    { date: iso(year, 1, 1), name_en: "New Year's Day", name_es: 'Año Nuevo' },
    { date: nthWeekday(year, 1, 1, 3), name_en: 'Martin Luther King Jr. Day', name_es: 'Día de Martin Luther King Jr.' },
    { date: nthWeekday(year, 2, 1, 3), name_en: "Presidents' Day", name_es: 'Día de los Presidentes' },
    { date: lastWeekday(year, 5, 1), name_en: 'Memorial Day', name_es: 'Día de los Caídos' },
    { date: iso(year, 6, 19), name_en: 'Juneteenth', name_es: 'Juneteenth' },
    { date: iso(year, 7, 4), name_en: 'Independence Day', name_es: 'Día de la Independencia' },
    { date: nthWeekday(year, 9, 1, 1), name_en: 'Labor Day', name_es: 'Día del Trabajo' },
    { date: nthWeekday(year, 10, 1, 2), name_en: 'Columbus Day', name_es: 'Día de la Raza' },
    { date: iso(year, 11, 11), name_en: 'Veterans Day', name_es: 'Día de los Veteranos' },
    { date: nthWeekday(year, 11, 4, 4), name_en: 'Thanksgiving', name_es: 'Acción de Gracias' },
    { date: iso(year, 12, 25), name_en: 'Christmas Day', name_es: 'Navidad' },
  ];
}
