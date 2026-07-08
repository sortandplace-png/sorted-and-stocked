// GET /api/hebcal?year=2026&month=9
//
// Wraps the Hebcal API for Lakewood, NJ (geonameid=5101760) and reshapes it
// into { "2026-09-11": { hebrewDate, isYomTov, isFast, isErevShabbos,
// candleLighting } } so the month view can do a plain object lookup per day
// instead of re-parsing Hebcal's event list on every render.
//
// Cached for 24h via Next's fetch cache — a given month's Jewish calendar
// data doesn't change once published, so there's no reason to hit Hebcal on
// every page load.

import { NextResponse } from 'next/server';

const GEONAME_ID = '5100280'; // Lakewood, NJ

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());
  const month = searchParams.get('month'); // 1-12, omit for "now"

  const url = new URL('https://www.hebcal.com/hebcal');
  url.searchParams.set('v', '1');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('maj', 'on');
  url.searchParams.set('min', 'on');
  url.searchParams.set('mod', 'on');
  url.searchParams.set('nx', 'on');
  url.searchParams.set('year', year);
  if (month) url.searchParams.set('month', month);
  url.searchParams.set('ss', 'on');
  url.searchParams.set('mf', 'on');
  url.searchParams.set('c', 'on');
  url.searchParams.set('D', 'on'); // per-day Hebrew date items (category "hebdate")
  url.searchParams.set('geo', 'geoname');
  url.searchParams.set('geonameid', GEONAME_ID);
  url.searchParams.set('m', '50');

  const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } });

  if (!res.ok) {
    return NextResponse.json({ error: 'Hebcal request failed' }, { status: 502 });
  }

  const raw = await res.json();
  const byDate: Record<
    string,
    {
      hebrewDate?: string;
      isYomTov: boolean;
      isFast: boolean;
      isErevShabbos: boolean;
      candleLighting?: string;
      titles: string[];
    }
  > = {};

  for (const item of raw.items ?? []) {
    const date = (item.date as string).slice(0, 10); // "2026-09-11T00:00:00" -> "2026-09-11"
    const entry = (byDate[date] ??= {
      isYomTov: false,
      isFast: false,
      isErevShabbos: false,
      titles: [],
    });

    entry.titles.push(item.title);

    if (item.category === 'hebdate') entry.hebrewDate = item.hebrew;
    if (item.category === 'holiday' && item.yomtov) entry.isYomTov = true;
    // Hebcal marks fast days as category "holiday" with subcat "fast" — there
    // is no top-level category === "fast".
    if (item.category === 'holiday' && item.subcat === 'fast') entry.isFast = true;
    if (item.category === 'candles') {
      entry.candleLighting = item.title.match(/(\d{1,2}:\d{2})/)?.[1];
      // Candle-lighting events in Hebcal fire on Erev Shabbos/Yom Tov itself.
      const day = new Date(date + 'T12:00:00').getDay();
      if (day === 5) entry.isErevShabbos = true;
    }
  }

  return NextResponse.json({ days: byDate });
}
