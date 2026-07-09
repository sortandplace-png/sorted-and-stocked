// components/YomTovYearClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type HebcalItem = { title: string; date: string; category: string; yomtov?: boolean };

type Entry = { title: string; date: string; isFast: boolean; isYomTov: boolean };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function YomTovYearClient({ propertyId }: { propertyId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A rolling year from today, not the calendar year — always
    // forward-looking regardless of when this is opened, and covers a full
    // Hebrew year's worth of dates even when opened mid-Gregorian-year.
    const start = toDateStr(new Date());
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 366);
    const end = toDateStr(endDate);

    const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=off&mod=off&mf=on&ss=off&nx=off&start=${start}&end=${end}`;
    let cancelled = false;

    fetch(url)
      .then((r) => r.json())
      .then((data: { items?: HebcalItem[] }) => {
        if (cancelled) return;
        const relevant = (data.items ?? [])
          .filter((item) => item.yomtov || item.category === 'fast')
          .map((item) => ({
            title: item.title,
            date: item.date.slice(0, 10),
            isFast: item.category === 'fast',
            isYomTov: !!item.yomtov,
          }));
        setEntries(relevant);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load the Jewish calendar right now — check your connection and try again.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = new Map<string, Entry[]>();
  for (const entry of entries) {
    const monthKey = entry.date.slice(0, 7); // YYYY-MM
    if (!grouped.has(monthKey)) grouped.set(monthKey, []);
    grouped.get(monthKey)!.push(entry);
  }

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto p-4">
      <Link
        href={`/properties/${propertyId}/meal-plan`}
        className="text-sm text-charcoal font-medium mb-3 inline-block"
      >
        ← Meal plan
      </Link>
      <h1 className="text-2xl font-display text-charcoal mb-1">Yom Tov — the year ahead</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Every major Yom Tov and fast day for the next 12 months, at a glance — for planning menus
        and shopping well in advance.
      </p>

      {loading && <p className="text-sm text-charcoal/40 text-center mt-8">Loading calendar…</p>}
      {error && <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center mt-8">No Yom Tov or fast dates found.</p>
      )}

      <div className="space-y-5">
        {[...grouped.entries()].map(([monthKey, monthEntries]) => (
          <div key={monthKey}>
            <h2 className="text-xs font-display italic tracking-[0.1em] text-charcoal/70 mb-2">
              {new Date(monthKey + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden">
              {monthEntries.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={
                      'text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ' +
                      (entry.isFast ? 'text-rust bg-rust/10' : 'text-cream bg-charcoal')
                    }
                  >
                    {entry.isFast ? '🕯️ Fast' : '✡︎ Yom Tov'}
                  </span>
                  <span className="flex-1 text-sm text-charcoal truncate">{entry.title}</span>
                  <span className="text-xs text-charcoal/40 shrink-0">
                    {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
