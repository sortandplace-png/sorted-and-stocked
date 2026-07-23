// app/api/zmanim/route.ts
// On-demand candle-lighting lookup for coordinates the client explicitly
// supplies (the dashboard's opt-in "use my location" button). Coordinates
// pass through this route only for the single Hebcal call below -- never
// written to the database, never logged, nothing persisted. If a reason to
// store location ever comes up, that's a separate decision with its own
// privacy-policy update, not something this route does by default.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const tzid = searchParams.get('tzid');

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !tzid) {
    return NextResponse.json({ error: 'Valid lat, lng, and tzid are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rateLimit = await checkRateLimit(supabase, 'zmanim_location', 30, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const res = await fetch(
      `https://www.hebcal.com/shabbat?cfg=json&latitude=${lat}&longitude=${lng}&tzid=${encodeURIComponent(tzid)}&M=on`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`Hebcal API error: ${res.status}`);
    const data = await res.json();
    const candle = data.items?.find((i: any) => i.category === 'candles');
    if (!candle) {
      return NextResponse.json({ error: 'No candle-lighting time available for this location right now.' }, { status: 404 });
    }

    // Pulls the pre-formatted local time straight out of Hebcal's own
    // title string ("Candle lighting: 8:11pm") instead of converting the
    // ISO date server-side -- same pattern already used correctly
    // elsewhere in this codebase (app/api/hebcal/route.ts), sidesteps any
    // timezone-conversion bug entirely.
    const timeMatch = (candle.title as string).match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
    const candleTime = timeMatch ? timeMatch[1].replace(/\s+/g, '') : null;
    const candleDateLabel = candle.date
      ? new Intl.DateTimeFormat('en-US', { timeZone: tzid, weekday: 'short', month: 'short', day: 'numeric' }).format(
          new Date(candle.date)
        )
      : null;

    if (!candleTime) {
      return NextResponse.json({ error: 'Could not parse a candle-lighting time for this location.' }, { status: 500 });
    }

    return NextResponse.json({ candleTime, candleDateLabel });
  } catch {
    return NextResponse.json({ error: 'Could not calculate candle lighting for this location.' }, { status: 500 });
  }
}
