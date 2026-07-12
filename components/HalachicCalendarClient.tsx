// components/HalachicCalendarClient.tsx
// Client-refactor of the old server-component page (app/properties/[id]/
// tools/halachic-calendar/page.tsx, now removed) so it can run inside
// ToolModal like the rest of the Household group. The Hebcal fetch logic
// itself is unchanged, just moved server-side into /api/tools/halachic-calendar
// so it can keep Next's fetch cache.
'use client';

import { useEffect, useState } from 'react';
import { SkeletonList } from '@/components/Skeleton';

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

  useEffect(() => {
    fetch('/api/tools/halachic-calendar')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList rows={3} />;

  const { omerTitle, erevPesach, daysUntilPesach } = data ?? { omerTitle: null, erevPesach: null, daysUntilPesach: null };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Halachic Calendar</h1>

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
