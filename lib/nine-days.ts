// lib/nine-days.ts
// The Nine Days: 1 Av through 9 Av (Tisha B'Av) inclusive, computed live via
// Hebcal's date converter -- no Hebrew<->Gregorian offset is hardcoded.
// Anchoring on July 15 of a Gregorian year to find that year's real Hebrew
// year works because Av always falls within June-September of exactly one
// Gregorian year (verified live: gy=2026/gm=7/gd=15 -> hy=5786; the same
// anchor for gy=2027 correctly resolves to hy=5787 even though July 15 2027
// itself falls in Tammuz, not yet Av -- the Hebrew *year* is still right).

export type DateWindow = { start: string; end: string };

async function convert(params: Record<string, string>): Promise<any> {
  const url = new URL('https://www.hebcal.com/converter');
  url.searchParams.set('cfg', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  return res.json();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export async function getNineDaysWindow(gregorianYear: number): Promise<DateWindow | null> {
  try {
    const anchor = await convert({ gy: String(gregorianYear), gm: '7', gd: '15', g2h: '1' });
    const hy = anchor.hy;
    const [oneAv, nineAv] = await Promise.all([
      convert({ hy: String(hy), hm: 'Av', hd: '1', h2g: '1' }),
      convert({ hy: String(hy), hm: 'Av', hd: '9', h2g: '1' }),
    ]);
    return {
      start: `${oneAv.gy}-${pad(oneAv.gm)}-${pad(oneAv.gd)}`,
      end: `${nineAv.gy}-${pad(nineAv.gm)}-${pad(nineAv.gd)}`,
    };
  } catch {
    // Fail open -- an unreachable Hebcal shouldn't block meal planning,
    // it just means the Nine Days check silently doesn't fire this run.
    return null;
  }
}

export async function getNineDaysWindows(gregorianYears: number[]): Promise<DateWindow[]> {
  const windows = await Promise.all(gregorianYears.map(getNineDaysWindow));
  return windows.filter((w): w is DateWindow => w !== null);
}

export function isInNineDays(dateStr: string, windows: DateWindow[]): boolean {
  return windows.some((w) => dateStr >= w.start && dateStr <= w.end);
}
