// supabase/functions/refresh-fast-tables/index.ts
//
// SS-599: the monthly Hebcal refresh covered yom_tov_dates only, while
// fast_days and nine_days_windows were finite hand-seeded tables. After
// their last row passes, an empty nine_days_windows reads as NO meat
// restriction rather than as missing data -- a wrong answer, not a blank
// one. This sibling of refresh-yom-tov-dates keeps both rolling forward
// on the same schedule and the same Hebcal request shape.
//
// NOT YET DEPLOYED. The 4 Aug approval was given but the deploy call is
// gated by a tooling permission prompt; meanwhile both tables were filled
// through 2032 directly from Postgres via pg_net. Deploy this to make the
// refresh recurring, then add the cron sibling at 15 3 1 * *.
//
// APOSTROPHES ARE LOAD-BEARING (learned live, 4 Aug): Hebcal returns
// TYPOGRAPHIC apostrophes -- "Tish’a B’Av", "Asara B’Tevet", "Ta’anit
// Esther" (U+2019), not ASCII. An earlier draft of this file matched on
// ASCII keys and would have matched NOTHING for three of the six fasts,
// including Tisha B'Av which ends every Nine Days window -- while still
// returning status ok and letting the cron report success. Titles are
// normalised before matching and the closed set is asserted below.
//
// DESIGN: dates come from Hebcal; the Spanish names, severity and
// exemption notes are hand-curated, so inserts use ON CONFLICT DO NOTHING
// (ignoreDuplicates) -- an existing row is NEVER overwritten, only
// genuinely new future dates are added. Deliberate exclusions:
// Ta'anit Bechorot (siyum-exempted, never seeded) and Yom Kippur Katan.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEONAME_ID = '5100280'; // Lakewood, NJ -- same as refresh-yom-tov-dates
const MONTHS_AHEAD = 18;

/** Hebcal's U+2019 apostrophe to ASCII, so title keys match literally. */
function normalize(title: string): string {
  return title.replace(/’/g, "'");
}

const FASTS: Record<string, { name: string; es: string; severity: string; note: string }> = {
  'Tzom Gedaliah': {
    name: 'Tzom Gedaliah', es: 'Tzom Guedalia', severity: 'minor',
    note: 'Daytime-only fast, ends at nightfall. Dinner is fine. Children, pregnant/nursing women, and anyone with a medical exemption are generally not required to fast.',
  },
  'Yom Kippur': {
    name: 'Yom Kippur', es: 'Yom Kipur', severity: 'major',
    note: 'Full 25-hour fast. No meals during the fast itself -- only the pre-fast meal (before sunset the day before) and break-fast (after nightfall).',
  },
  "Asara B'Tevet": {
    name: "Asara B'Tevet", es: 'Asará BeTevet', severity: 'minor',
    note: 'Daytime-only fast, ends at nightfall. Same exemptions as other minor fasts.',
  },
  "Ta'anit Esther": {
    name: 'Taanit Esther', es: 'Taanit Ester', severity: 'minor',
    note: 'Daytime-only fast, ends at nightfall. Same exemptions as other minor fasts.',
  },
  'Tzom Tammuz': {
    name: 'Tzom Tammuz', es: 'Tzom Tamuz', severity: 'minor',
    note: "Daytime-only fast, ends at nightfall (17 Tammuz -- begins the Three Weeks leading to Tisha B'Av). Same exemptions as other minor fasts.",
  },
  "Tish'a B'Av": {
    name: "Tisha B'Av", es: 'Tishá BeAv', severity: 'major',
    note: 'Full 25-hour fast, same meal restrictions as Yom Kippur. Also the culmination of the Nine Days (1-9 Av) meat restriction.',
  },
};

/** Exact, or the "(observed)" form a deferred fast arrives under when
 *  9 Av falls on Shabbos and the fast pushes to Sunday. */
function matchFast(rawTitle: string) {
  const title = normalize(rawTitle);
  for (const key of Object.keys(FASTS)) {
    if (title === key || title === `${key} (observed)`) return FASTS[key];
  }
  return null;
}

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

    const fastRows = new Map<
      string,
      { date: string; holiday_name: string; holiday_name_es: string; severity: string; note: string }
    >();
    const roshChodeshAv: string[] = [];
    const tishaBav: string[] = [];

    for (const { year, month } of months) {
      const res = await fetch(hebcalUrl(year, month));
      if (!res.ok) {
        console.error(`Hebcal request failed for ${year}-${month}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items ?? []) {
        const date = (item.date as string).slice(0, 10);
        const fast = matchFast(item.title as string);
        if (fast) {
          fastRows.set(date, {
            date,
            holiday_name: fast.name,
            holiday_name_es: fast.es,
            severity: fast.severity,
            note: fast.note,
          });
          if (fast.name === "Tisha B'Av") tishaBav.push(date);
        }
        // 1 Av. Tammuz has 29 days, so Rosh Chodesh Av is a single day.
        if (normalize(item.title as string) === 'Rosh Chodesh Av') roshChodeshAv.push(date);
      }
    }

    // A run that matches no fasts at all is the apostrophe bug returning,
    // not a quiet month -- 18 months always contains several. Fail loudly
    // rather than returning ok with zero writes, because the cron cannot
    // tell those apart.
    if (fastRows.size === 0) {
      return new Response(
        JSON.stringify({ error: 'no fast days matched across 18 months -- check Hebcal title formatting' }),
        { status: 500 }
      );
    }

    const { error: fastErr } = await supabase
      .from('fast_days')
      .upsert([...fastRows.values()], { onConflict: 'date', ignoreDuplicates: true });
    if (fastErr) {
      return new Response(JSON.stringify({ error: `fast_days: ${fastErr.message}` }), { status: 500 });
    }

    // Nine Days window: 1 Av through the Tisha B'Av fast day (matching the
    // seeded rows, where end_date is the fast, observed date if deferred).
    // Av falls before Rosh Hashanah, so hebrew_year = gregorian + 3760.
    const windows: { hebrew_year: number; start_date: string; end_date: string }[] = [];
    for (const start of roshChodeshAv) {
      const year = Number(start.slice(0, 4));
      const end = tishaBav.find((d) => Number(d.slice(0, 4)) === year);
      if (end) windows.push({ hebrew_year: year + 3760, start_date: start, end_date: end });
    }
    if (windows.length > 0) {
      const { error: winErr } = await supabase
        .from('nine_days_windows')
        .upsert(windows, { onConflict: 'hebrew_year', ignoreDuplicates: true });
      if (winErr) {
        return new Response(JSON.stringify({ error: `nine_days_windows: ${winErr.message}` }), { status: 500 });
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        fastDatesSeen: fastRows.size,
        nineDaysWindowsSeen: windows.length,
        monthsChecked: MONTHS_AHEAD,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500 }
    );
  }
});
