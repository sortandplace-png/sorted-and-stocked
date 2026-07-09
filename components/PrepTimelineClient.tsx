// components/PrepTimelineClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';

type Entry = {
  id: string;
  course: string;
  recipes: { name: string; approx_total_minutes: number | null } | null;
  custom_name: string | null;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function minutesToClock(baseMinutes: number, offsetMinutes: number): string {
  const total = baseMinutes - offsetMinutes;
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function PrepTimelineClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const [date, setDate] = useState(todayStr());
  const [readyTime, setReadyTime] = useState('18:00');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('meal_plan_entries')
      .select('id, course, custom_name, recipes(name, approx_total_minutes)')
      .eq('property_id', propertyId)
      .eq('plan_date', date)
      .then(({ data }) => {
        setEntries((data ?? []) as unknown as Entry[]);
        setLoading(false);
      });
  }, [propertyId, date, supabase]);

  const [readyHour, readyMinute] = readyTime.split(':').map(Number);
  const readyTotalMinutes = readyHour * 60 + readyMinute;

  const withTimes = entries
    .filter((e) => e.recipes?.approx_total_minutes != null)
    .map((e) => ({
      name: e.recipes!.name,
      minutes: e.recipes!.approx_total_minutes!,
      startClock: minutesToClock(readyTotalMinutes, e.recipes!.approx_total_minutes!),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const noTimeRecorded = entries.filter((e) => e.recipes && e.recipes.approx_total_minutes == null);
  const customOnly = entries.filter((e) => !e.recipes && e.custom_name);

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Prep Timeline</h1>
      <p className="text-sm text-charcoal/50 mb-4">Working backward from when you want dinner ready.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={readyTime}
          onChange={(e) => setReadyTime(e.target.value)}
          className="flex-1 border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">Nothing planned for this day yet.</p>
      )}

      {withTimes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-4">
          <ul className="space-y-3">
            {withTimes.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gold-dark w-20 shrink-0">{item.startClock}</span>
                <div className="flex-1 border-l-2 border-gold-light/40 pl-3">
                  <p className="text-sm text-charcoal">{item.name}</p>
                  <p className="text-xs text-charcoal/40">~{item.minutes} min</p>
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="text-sm font-medium text-charcoal w-20 shrink-0">
                {minutesToClock(readyTotalMinutes, 0)}
              </span>
              <p className="text-sm text-charcoal font-medium">🍽️ Ready to serve</p>
            </li>
          </ul>
        </div>
      )}

      {(noTimeRecorded.length > 0 || customOnly.length > 0) && (
        <div className="bg-cream rounded-2xl p-4">
          <p className="text-xs text-charcoal/50 mb-2">No prep time recorded — can't schedule these:</p>
          <ul className="space-y-1">
            {noTimeRecorded.map((e) => (
              <li key={e.id} className="text-sm text-charcoal/70">
                {e.recipes!.name}
              </li>
            ))}
            {customOnly.map((e) => (
              <li key={e.id} className="text-sm text-charcoal/70">
                {e.custom_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
