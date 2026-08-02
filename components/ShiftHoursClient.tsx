// components/ShiftHoursClient.tsx
// SS-285 manager view: hours by person, by week, property-scoped.
//
// Read-only on purpose. Corrections go through Supabase directly until
// there is a real need for an in-app edit flow -- and shift_corrections
// is already there to record them when that day comes (its RLS is
// owner/manager read, so this page could surface an audit trail later
// without a schema change).
//
// No pay rate, no export, no break tracking. Confirmed out of scope.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';
import Pin from '@/components/PinAccent';
import { CalendarDays } from 'lucide-react';

type ShiftRow = {
  id: string;
  user_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
};
type Member = { user_id: string; full_name: string | null; email: string | null };

/** Monday-start week key, as an ISO date, in the viewer's local time. */
function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  const tzAdjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 10);
}

function hoursBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

/** 7.25 -> "7h 15m". Managers read a timesheet, not a decimal. */
function formatHours(h: number): string {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function ShiftHoursClient({
  propertyId,
  // The heading lives here rather than in the page because the page is a
  // server component and these strings have to go through next-intl (R19).
  showHeading = false,
}: {
  propertyId: string;
  showHeading?: boolean;
}) {
  const supabase = createClient();
  const locale = useLocale();
  const t = useTranslations('hoursSection');
  const es = locale === 'es';

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: shiftRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, user_id, clocked_in_at, clocked_out_at')
        .eq('property_id', propertyId)
        .order('clocked_in_at', { ascending: false }),
      supabase.from('property_members').select('user_id, profiles(full_name, email)').eq('property_id', propertyId),
    ]);
    setShifts((shiftRows as ShiftRow[]) ?? []);
    setMembers(
      (memberRows ?? []).map((m) => {
        const prof = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
        return { user_id: m.user_id, full_name: prof?.full_name ?? null, email: prof?.email ?? null };
      })
    );
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // "Unnamed" is banned (SS-436 reopen) -- email is the fallback identity.
  const nameByUser = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.full_name?.trim() || m.email || m.user_id.slice(0, 8)])),
    [members]
  );

  // week -> user -> { hours, shifts, openShifts }
  const byWeek = useMemo(() => {
    const weeks = new Map<string, Map<string, { hours: number; count: number; open: number }>>();
    for (const s of shifts) {
      const wk = weekStart(s.clocked_in_at);
      const perUser = weeks.get(wk) ?? new Map();
      const cur = perUser.get(s.user_id) ?? { hours: 0, count: 0, open: 0 };
      // An open shift contributes no hours -- counting "now minus clock-in"
      // would make a forgotten clock-out silently inflate someone's week
      // and keep growing. It is surfaced as an explicit note instead, which
      // is a thing a manager can act on.
      if (s.clocked_out_at) cur.hours += hoursBetween(s.clocked_in_at, s.clocked_out_at);
      else cur.open += 1;
      cur.count += 1;
      perUser.set(s.user_id, cur);
      weeks.set(wk, perUser);
    }
    return [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [shifts]);

  function weekLabel(startIso: string): string {
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  const heading = showHeading ? (
    <>
      <h2 className="text-2xl font-display text-denim mb-1">{t('title')}</h2>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>
    </>
  ) : null;

  if (loading)
    return (
      <>
        {heading}
        <SkeletonList rows={3} />
      </>
    );

  if (byWeek.length === 0) {
    return (
      <>
        {heading}
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-2xl shadow-card">{t('empty')}</p>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {heading}
      {byWeek.map(([week, perUser]) => {
        const rows = [...perUser.entries()].sort((a, b) => b[1].hours - a[1].hours);
        const weekTotal = rows.reduce((sum, [, v]) => sum + v.hours, 0);
        return (
          <div
            key={week}
            className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden"
          >
            <Pin size="sm" />
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cardBorder">
              <CalendarDays size={14} className="text-brass shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-display text-denim">{weekLabel(week)}</span>
              <span className="ml-auto text-xs text-dusk">{formatHours(weekTotal)}</span>
            </div>
            <ul className="divide-y divide-cardBorder">
              {rows.map(([userId, v]) => (
                <li key={userId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 min-w-0 text-sm text-denim truncate">
                    {nameByUser.get(userId) ?? userId.slice(0, 8)}
                  </span>
                  {v.open > 0 && (
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-briar-bg border border-briar-border text-briar">
                      {es ? 'sin salida' : 'still clocked in'}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-dusk">
                    {v.count} {v.count === 1 ? (es ? 'turno' : 'shift') : es ? 'turnos' : 'shifts'}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-denim tabular-nums">
                    {formatHours(v.hours)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
