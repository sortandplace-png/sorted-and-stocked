// supabase/functions/refresh-yom-tov-dates/index.ts
//
// Refreshes the yom_tov_dates cache (date, holiday_name) from Hebcal so the
// meal-plan buffer logic keeps reading from a fast local table instead of
// hitting Hebcal on every page load. Reuses the exact same Hebcal request
// shape as app/api/hebcal/route.ts (classic hebcal.com/hebcal endpoint,
// Lakewood NJ geoname, maj/min/mod=on) rather than a second integration --
// only difference is this loops across many months instead of one, and
// filters to real Yom Tov days (category 'holiday' with yomtov: true).
//
// Upserts on `date` so re-running never duplicates or wipes existing rows.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEONAME_ID = '5100280'; // Lakewood, NJ -- same as api/hebcal/route.ts
const MONTHS_AHEAD = 18;

function hebcalUrl(year: number, month: number) {
  const url = new URL('https://www.hebcal.com/hebcal');
  url.searchParams.set('v', '1');
  url.searchParams.set('cfg', 'json');
  url.searchParams.set('maj', 'on');
  url.searchParams.set('min', 'on');
  url.searchParams.set('mod', 'on');
  url.searchParams.set('nx', 'on');
  url.searchParams.set('year', String(year));
  url.searchParams.set('month', String(month));
  url.searchParams.set('ss', 'on');
  url.searchParams.set('mf', 'on');
  url.searchParams.set('c', 'on');
  url.searchParams.set('geo', 'geoname');
  url.searchParams.set('geonameid', GEONAME_ID);
  url.searchParams.set('m', '50');
  return url.toString();
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const rows = new Map<string, string>(); // date -> holiday_name
    for (const { year, month } of months) {
      const res = await fetch(hebcalUrl(year, month));
      if (!res.ok) {
        console.error(`Hebcal request failed for ${year}-${month}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items ?? []) {
        if (item.category === 'holiday' && item.yomtov === true) {
          const date = (item.date as string).slice(0, 10);
          // A multi-day Yom Tov (e.g. 2 days of Rosh Hashana) produces one
          // Hebcal item per day already -- if the same date somehow repeats
          // across overlapping month requests, last-write-wins is fine
          // since it's the same real holiday either way.
          rows.set(date, item.title);
        }
      }
    }

    const upsertRows = [...rows.entries()].map(([date, holiday_name]) => ({ date, holiday_name }));
    if (upsertRows.length === 0) {
      return new Response(JSON.stringify({ status: 'no yom tov dates found', upserted: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('yom_tov_dates').upsert(upsertRows, { onConflict: 'date' });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ status: 'ok', upserted: upsertRows.length, monthsChecked: MONTHS_AHEAD }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
    });
  }
});
