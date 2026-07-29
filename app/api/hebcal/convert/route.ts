// GET /api/hebcal/convert
//
// Hebrew <-> Gregorian conversion, for the Yom Tov Year View's Jump to Date
// panel. Three modes:
//
//   ?mode=g2h&gy=2026&gm=9&gd=12   -> Hebrew date for a Gregorian date
//   ?mode=h2g&hy=5787&hm=Tishrei&hd=1 -> Gregorian date for a Hebrew date
//   ?mode=months&hy=5787           -> that year's months, in order, with
//                                     day counts and Hebrew labels
//
// The codebase's existing Hebcal integration (app/api/hebcal, app/api/zmanim,
// app/api/tools/halachic-calendar, refresh-yom-tov-dates) all hit the
// hebcal.com/hebcal CALENDAR endpoint, which returns events -- it does not
// convert dates. The converter is a separate Hebcal endpoint, so this adds a
// route rather than reusing one. It follows the same conventions the others
// established: proxied server-side so the browser never calls Hebcal
// directly, and cached through Next's fetch cache.
//
// Cached for 30 days, not 24h. The mapping between a Hebrew date and a
// Gregorian date is fixed arithmetic -- unlike candle-lighting times, it
// cannot change once published, so the shorter window the calendar route
// uses would only add cache misses.
import { NextResponse } from 'next/server';

const CONVERTER = 'https://www.hebcal.com/converter';
const REVALIDATE = 60 * 60 * 24 * 30;

// Hebcal's own spellings, verified against the API for 5786/5787/5788:
// "Sh'vat" carries the apostrophe and "Tamuz" has one m. Adar is the only
// month whose name depends on the year -- in a leap year Hebcal resolves
// bare "Adar" to "Adar II" and "Adar I" is a distinct month; in a common
// year all three spellings collapse to "Adar". That is why the month list
// is derived per-year below instead of being a constant: a fixed
// Tishrei-Elul list is wrong for 5787, which is a leap year.
const COMMON_MONTHS = [
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  "Sh'vat",
  'Adar',
  'Nisan',
  'Iyyar',
  'Sivan',
  'Tamuz',
  'Av',
  'Elul',
];
const LEAP_MONTHS = [
  'Tishrei',
  'Cheshvan',
  'Kislev',
  'Tevet',
  "Sh'vat",
  'Adar I',
  'Adar II',
  'Nisan',
  'Iyyar',
  'Sivan',
  'Tamuz',
  'Av',
  'Elul',
];

type HebcalConversion = {
  gy: number;
  gm: number;
  gd: number;
  hy: number;
  hm: string;
  hd: number;
  hebrew?: string;
  heDateParts?: { y: string; m: string; d: string };
  events?: string[];
};

async function hebcal(params: Record<string, string>): Promise<HebcalConversion | null> {
  const url = new URL(CONVERTER);
  url.searchParams.set('cfg', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { next: { revalidate: REVALIDATE } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.error || typeof json?.hy !== 'number') return null;
  return json as HebcalConversion;
}

function toIso(c: HebcalConversion): string {
  return `${c.gy}-${String(c.gm).padStart(2, '0')}-${String(c.gd).padStart(2, '0')}`;
}

/** Leap years have a real Adar I; in a common year Hebcal folds it to Adar. */
async function isLeap(hy: number): Promise<boolean> {
  const adarI = await hebcal({ hy: String(hy), hm: 'Adar I', hd: '1', h2g: '1' });
  return adarI?.hm === 'Adar I';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');

  try {
    if (mode === 'g2h') {
      const gy = searchParams.get('gy');
      const gm = searchParams.get('gm');
      const gd = searchParams.get('gd');
      if (!gy || !gm || !gd) return NextResponse.json({ error: 'gy, gm, gd required' }, { status: 400 });
      const c = await hebcal({ gy, gm, gd, g2h: '1' });
      if (!c) return NextResponse.json({ error: 'Hebcal request failed' }, { status: 502 });
      return NextResponse.json({
        iso: toIso(c),
        hy: c.hy,
        hm: c.hm,
        hd: c.hd,
        hebrew: c.hebrew ?? null,
        heParts: c.heDateParts ?? null,
      });
    }

    if (mode === 'h2g') {
      const hy = searchParams.get('hy');
      const hm = searchParams.get('hm');
      const hd = searchParams.get('hd');
      if (!hy || !hm || !hd) return NextResponse.json({ error: 'hy, hm, hd required' }, { status: 400 });
      const c = await hebcal({ hy, hm, hd, h2g: '1' });
      if (!c) return NextResponse.json({ error: 'Hebcal request failed' }, { status: 502 });
      return NextResponse.json({
        iso: toIso(c),
        hy: c.hy,
        hm: c.hm,
        hd: c.hd,
        hebrew: c.hebrew ?? null,
        heParts: c.heDateParts ?? null,
      });
    }

    if (mode === 'months') {
      const hyRaw = searchParams.get('hy');
      if (!hyRaw) return NextResponse.json({ error: 'hy required' }, { status: 400 });
      const hy = Number(hyRaw);
      const names = (await isLeap(hy)) ? LEAP_MONTHS : COMMON_MONTHS;

      // Day count comes from the distance to the next month's first day, so
      // 29- vs 30-day months (Cheshvan and Kislev vary by year) are right
      // without a table. The day dropdown must not offer a 30th that does
      // not exist.
      const firsts = await Promise.all(
        names.map((m) => hebcal({ hy: String(hy), hm: m, hd: '1', h2g: '1' }))
      );
      const nextTishrei = await hebcal({ hy: String(hy + 1), hm: 'Tishrei', hd: '1', h2g: '1' });
      if (firsts.some((f) => !f) || !nextTishrei) {
        return NextResponse.json({ error: 'Hebcal request failed' }, { status: 502 });
      }

      const months = names.map((name, i) => {
        const start = firsts[i]!;
        const nextStart = i + 1 < firsts.length ? firsts[i + 1]! : nextTishrei;
        const days = Math.round(
          (Date.parse(`${toIso(nextStart)}T00:00:00Z`) - Date.parse(`${toIso(start)}T00:00:00Z`)) /
            86_400_000
        );
        return {
          name,
          hebrewName: start.heDateParts?.m ?? name,
          days,
          startIso: toIso(start),
        };
      });

      return NextResponse.json({ hy, leap: names.length === 13, months });
    }

    return NextResponse.json({ error: 'mode must be g2h, h2g or months' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Hebcal request failed' }, { status: 502 });
  }
}
