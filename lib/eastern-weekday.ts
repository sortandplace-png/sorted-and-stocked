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

// SS-208. The Eastern-local calendar date as 'yyyy-MM-dd'. Extracted here
// after a live audit found ~14 real call sites computing "today" via
// new Date().toISOString().slice(0,10) or date-fns format(new Date(), ...)
// with no timeZone -- both read whatever timezone the JS RUNTIME defaults
// to (Vercel is UTC, not Eastern), so from roughly 8pm Eastern to midnight
// every one of them was silently a day ahead. This is the app-layer
// counterpart to the database's public.eastern_today() (migration 224) --
// same fix, same reason, one shared place instead of patching each site
// with its own copy of the same Intl incantation (the database side of
// this exact bug had already drifted into 46 hand-kept call sites before
// it was consolidated; this exists so the app side doesn't repeat that).
//
// en-CA is not cosmetic: it is the one common locale that formats a date
// as YYYY-MM-DD, so the output sorts and string-compares correctly
// against every other date string in this app without reformatting.
// Works identically in the browser and on the server (no server-only
// dependency), so it is safe to call from a 'use client' component too.
export function getEasternDateStr(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
