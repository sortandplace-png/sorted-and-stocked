// app/properties/[id]/tools/yom-tov-year-view/page.tsx
// Fetches only. The view is a client component because the LIST/CALENDAR
// toggle and month navigation are state, and because every string on the
// page had to stop being hardcoded English (R19) -- this page shipped its
// title, subtitle, empty state and en-US date formatting inline.
//
// Two tables, merged. yom_tov_dates has no fast days in it; fast_days is a
// separate table, and the spec's third visual tier is entirely sourced from
// it. get-next-observance.ts already merges the same two the same way.
import { createClient } from '@/lib/supabase/server';
import YomTovYearViewClient, { type Observance } from '@/components/YomTovYearViewClient';
import { classifyObservance } from '@/lib/yom-tov';

export default async function YomTovYearViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // SS-469: layers + zip decide what the grid shows -- Henderson {civil}
  // gets a plain American calendar; candle times key to the property's
  // OWN zip (Henderson NV and Lakewood NJ are three time zones apart).
  const { data: property } = await supabase
    .from('properties')
    .select('zip, calendar_layers')
    .eq('id', id)
    .maybeSingle();
  const calendarLayers = (property?.calendar_layers as string[] | null) ?? ['jewish', 'civil'];

  // Neither table is property-scoped (shared calendar data, same tables the
  // Dashboard's Erev Yom Tov check and header countdown pill already read).
  const [{ data: yomTov }, { data: fasts }] = await Promise.all([
    supabase.from('yom_tov_dates').select('date, holiday_name, holiday_name_es').order('date'),
    supabase.from('fast_days').select('date, holiday_name, holiday_name_es').order('date'),
  ]);

  const yomTovRows: Observance[] = (yomTov ?? []).map((r) => ({
    date: r.date,
    name_en: r.holiday_name,
    name_es: r.holiday_name_es,
    kind: classifyObservance(r.holiday_name),
  }));

  // Yom Kippur appears in both tables. The yom_tov_dates row wins, matching
  // the precedence calendar-trigger-type.ts already applies -- otherwise the
  // same day renders twice, once denim and once rust.
  const yomTovDates = new Set(yomTovRows.map((r) => r.date));
  const fastRows: Observance[] = (fasts ?? [])
    .filter((r) => !yomTovDates.has(r.date))
    .map((r) => ({
      date: r.date,
      name_en: r.holiday_name,
      name_es: r.holiday_name_es,
      kind: classifyObservance(r.holiday_name, true),
    }));

  const observances = [...yomTovRows, ...fastRows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <YomTovYearViewClient
      propertyId={id}
      // A civil-only house doesn't receive the jewish rows at all -- the
      // layer is enforced at the data edge, not just in rendering.
      observances={calendarLayers.includes('jewish') ? observances : []}
      calendarLayers={calendarLayers}
      zip={property?.zip ?? null}
    />
  );
}
