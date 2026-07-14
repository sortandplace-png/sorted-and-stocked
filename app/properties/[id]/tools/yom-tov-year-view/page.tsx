// app/properties/[id]/tools/yom-tov-year-view/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function YomTovYearViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // yom_tov_dates isn't property-scoped (shared calendar data, same table
  // the Dashboard's Erev Yom Tov check and header countdown pill already
  // read) -- no property_id filter needed.
  const { data } = await supabase.from('yom_tov_dates').select('date, holiday_name').order('date', { ascending: true });
  const dates = data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-md mx-auto p-4">
      <Link href={`/properties/${id}/tools`} className="text-sm text-charcoal/60 mb-4 inline-block">
        ← Tools
      </Link>
      <h1 className="text-2xl font-display text-charcoal mb-1">Yom Tov Year View</h1>
      <p className="text-sm text-charcoal/50 mb-6">Every Yom Tov date on the calendar, at a glance.</p>

      {dates.length === 0 ? (
        <p className="text-sm text-charcoal/40">No dates on the calendar yet.</p>
      ) : (
        <ul className="space-y-2">
          {dates.map((d) => {
            const isPast = d.date < today;
            return (
              <li
                key={`${d.date}-${d.holiday_name}`}
                className={
                  'flex items-center justify-between rounded-xl px-4 py-3 border ' +
                  (isPast
                    ? 'border-gold-light/20 bg-cream opacity-50'
                    : 'border-gold-light/40 bg-white shadow-sm shadow-charcoal/5')
                }
              >
                <span className="font-medium text-charcoal">{d.holiday_name}</span>
                <span className="text-sm text-charcoal/50">
                  {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
