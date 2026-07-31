// app/api/hebcal/month/route.ts
// SS-465/SS-466: one month of computed Jewish calendar data for the month
// grid -- Shabbos candle-lighting/havdalah times keyed to a ZIP (three
// time zones separate Henderson NV and Lakewood NJ, so this can never be
// one global time) plus Rosh Chodesh days. Computed from Hebcal per R1,
// never seeded; Next's fetch cache (24h) keeps this to at most one real
// Hebcal call per month+zip per day.
//
// Deliberately NOT returning yom tov / fast events yet: the grid still
// reads those from yom_tov_dates/fast_days (populated through 2027), and
// serving both sources at once would double-render every holiday. The R1
// migration path is to swap that table read for this route's data in one
// change, not to overlap them.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gy = Number(searchParams.get('gy'));
  const gm = Number(searchParams.get('gm'));
  const zip = (searchParams.get('zip') ?? '').replace(/[^0-9]/g, '').slice(0, 5);

  if (!gy || !gm || gm < 1 || gm > 12 || gy < 2000 || gy > 2100) {
    return NextResponse.json({ error: 'bad month' }, { status: 400 });
  }

  try {
    // c=on needs a location; without a zip we still get Rosh Chodesh (nx).
    const loc = zip.length === 5 ? `&c=on&M=on&zip=${zip}` : '';
    const res = await fetch(
      `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${gy}&month=${gm}&nx=on${loc}`,
      { next: { revalidate: 3600 * 24 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'hebcal unavailable' }, { status: 502 });
    const data = await res.json();
    const items: { title: string; date: string; category: string; hebrew?: string }[] = data.items ?? [];

    // Candle/havdalah item dates are full ISO datetimes in the zip's OWN
    // timezone offset; the grid needs the local clock time and the local
    // calendar day, both of which are already encoded in the string.
    const times = items
      .filter((i) => i.category === 'candles' || i.category === 'havdalah')
      .map((i) => ({
        category: i.category as 'candles' | 'havdalah',
        date: i.date.slice(0, 10),
        time: (() => {
          const m = i.date.match(/T(\d{2}):(\d{2})/);
          if (!m) return null;
          const h = Number(m[1]);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          return `${h12}:${m[2]} ${ampm}`;
        })(),
      }))
      .filter((t) => t.time);

    const roshChodesh = items
      .filter((i) => i.category === 'roshchodesh')
      .map((i) => ({ date: i.date.slice(0, 10), title: i.title, hebrew: i.hebrew ?? null }));

    return NextResponse.json({ times, roshChodesh });
  } catch {
    return NextResponse.json({ error: 'hebcal unavailable' }, { status: 502 });
  }
}
