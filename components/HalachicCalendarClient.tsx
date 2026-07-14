// components/HalachicCalendarClient.tsx
// Client-refactor of the old server-component page (app/properties/[id]/
// tools/halachic-calendar/page.tsx, now removed) so it can run inside
// ToolModal like the rest of the Household group. The Hebcal fetch logic
// itself is unchanged, just moved server-side into /api/tools/halachic-calendar
// so it can keep Next's fetch cache.
'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { SkeletonList } from '@/components/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { groupYomTovOccasions, type YomTovOccasion } from '@/lib/yom-tov';

const BEDIKAS_TOLAIM_ITEMS = [
  { item: 'Romaine lettuce', note: 'Check leaves individually against light, or use pre-checked bagged romaine.' },
  { item: 'Broccoli & cauliflower', note: 'Soak in soapy water, separate florets, check crevices carefully.' },
  { item: 'Strawberries & berries', note: 'Rinse well and inspect — hollow/soft spots often hide insects.' },
  { item: 'Asparagus', note: 'Check under the tips/scales near the head.' },
  { item: 'Brussels sprouts', note: 'Peel back outer leaves and check between layers.' },
  { item: 'Herbs (parsley, dill, cilantro)', note: 'Rinse and inspect stems closely — a common source of overlooked bugs.' },
  { item: 'Corn on the cob', note: 'Check silk and tip carefully before cooking.' },
];

type CalendarData = {
  omerTitle: string | null;
  erevPesach: { title: string; date: string } | null;
  daysUntilPesach: number | null;
};

export default function HalachicCalendarClient() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<YomTovOccasion[] | null>(null);

  useEffect(() => {
    fetch('/api/tools/halachic-calendar')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));

    // Separate from the Hebcal-backed Erev Pesach countdown above — this
    // reuses the existing yom_tov_dates table (same source as the Dashboard
    // card), no second date engine.
    const supabase = createClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    supabase
      .from('yom_tov_dates')
      .select('date, holiday_name')
      .gte('date', todayStr)
      .order('date')
      .then(({ data: rows }) => {
        setUpcoming(groupYomTovOccasions(rows || [], todayStr).slice(0, 3));
      });
  }, []);

  if (loading) return <SkeletonList rows={3} />;

  const { omerTitle, erevPesach, daysUntilPesach } = data ?? { omerTitle: null, erevPesach: null, daysUntilPesach: null };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Halachic Calendar</h1>

      {upcoming && upcoming.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
          <h2 className="font-display text-lg text-charcoal mb-2">Upcoming</h2>
          <ul className="space-y-1.5">
            {upcoming.map((occ) => (
              <li key={occ.name + occ.date} className="flex items-center justify-between text-sm">
                <span className="font-medium text-charcoal">{occ.name}</span>
                <span className="text-charcoal/60">
                  {format(parseISO(occ.date), 'MMM d')} · {occ.daysUntil === 0 ? 'today' : `${occ.daysUntil} day${occ.daysUntil === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-1">Sefiras HaOmer</h2>
        {omerTitle ? (
          <p className="text-sm text-charcoal">Tonight/today: {omerTitle}</p>
        ) : (
          <p className="text-sm text-charcoal/50">Not currently within the Omer count.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-1">Erev Pesach Countdown</h2>
        {erevPesach && daysUntilPesach !== null ? (
          <p className="text-sm text-charcoal">
            {daysUntilPesach === 0
              ? 'Erev Pesach is today.'
              : `${daysUntilPesach} day${daysUntilPesach === 1 ? '' : 's'} until Erev Pesach (${new Date(
                  erevPesach.date
                ).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}).`}
          </p>
        ) : (
          <p className="text-sm text-charcoal/50">Couldn't load the date right now.</p>
        )}
        <p className="text-xs text-charcoal/40 mt-1">
          Date only, not halachic times — Hebcal doesn't expose sof zman achilas/biur chametz through this API.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
        <h2 className="font-display text-lg text-charcoal mb-2">Bedikas Tolaim Reference</h2>
        <ul className="space-y-2">
          {BEDIKAS_TOLAIM_ITEMS.map((entry) => (
            <li key={entry.item}>
              <p className="text-sm font-medium text-charcoal">{entry.item}</p>
              <p className="text-xs text-charcoal/60">{entry.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
