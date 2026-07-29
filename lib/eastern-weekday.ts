// lib/eastern-weekday.ts
// The Eastern-local ISO weekday (1=Monday..7=Sunday), extracted from
// app/properties/[id]/my-day/page.tsx's own eastern() helper so client
// components can compute "today" the same correct way that page already
// does, rather than a second, possibly-inconsistent implementation.
//
// Intl.DateTimeFormat with an explicit timeZone works identically in the
// browser as on the server -- this has no server-only dependency, so it is
// safe to call from a 'use client' component. my-day/page.tsx itself is
// left as-is rather than refactored to import this: it also derives
// todayStr and timeBlock from the same parts, and there is no reason to
// risk a working, live page for a DRY-ness gain this ticket did not ask
// for.
export function getEasternIsoWeekday(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  // ISO 8601: 1=Monday..7=Sunday. Mapped directly from Intl's short weekday
  // name rather than derived from JS Date.getDay() (0=Sunday, local
  // machine time) -- the Intl parts are already the real Eastern-local day
  // regardless of what timezone the browser or device itself is set to.
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday as string] ?? 1;
}
