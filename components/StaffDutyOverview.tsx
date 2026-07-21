// components/StaffDutyOverview.tsx
// SS-156: a manager/owner-facing summary of today's staff_duty_templates
// completion -- percentage complete, per-roster breakdown, last completion
// time. Deliberately separate from StaffDutyChecklist.tsx, which is the
// personal "check off my own tasks" view gated on the viewer's own
// staff_roster_key -- this is the audit view, showing everyone's rows
// regardless of who's looking, which is exactly what RLS already allows
// for an owner/manager (see staff_duty_templates_select /
// staff_duty_completions_select: scoped to the caller's own roster key,
// OR unrestricted for owner/manager). Same day/date matching convention
// as my-day/page.tsx's getDutyAreas() (ISO weekday from real Eastern
// date parts, not Date.getDay()) so this can never disagree with what
// staff themselves see as "today."
//
// Real, current caveat worth knowing before reading this data as
// "assigned but incomplete": staff_roster_key on staff_duty_templates
// is a real per-person key (amber/leti/marlyn/live_in, see
// DutyRosterEditor.tsx), but property_members.staff_roster_key -- the
// column that would link one of those keys to an actual signed-in
// account -- is null on all 7 current members. Nobody has been linked
// yet, so the personal StaffDutyChecklist view is currently a dead end
// for every real staff member (hasRosterKey is false for all of them),
// and 100% of today's applicable duties here will show as 'Unassigned'
// (staff_roster_key = 'unassigned' on every one of the 61 real rows) --
// not a bug in this component, an accurate reflection of a roster that
// was built but never actually distributed to specific people.
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROSTER_LABELS } from '@/components/DutyRosterEditor';

type RosterStat = { key: string; total: number; done: number; lastCompletedAt: string | null };

function easternTodayParts(now: Date) {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const todayStr = `${map.year}-${map.month}-${map.day}`;
  // Same mapping as my-day/page.tsx's eastern() -- ISO weekday, 1=Mon..7=Sun.
  const isoWeekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[map.weekday as string] ?? 1;
  return { todayStr, isoWeekday };
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Nothing completed yet';
  return `Last completed ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function StaffDutyOverview({ propertyId }: { propertyId: string }) {
  const [stats, setStats] = useState<RosterStat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { todayStr, isoWeekday } = easternTodayParts(new Date());

      const { data: templates } = await supabase
        .from('staff_duty_templates')
        .select('id, staff_roster_key')
        .eq('property_id', propertyId)
        .or(`day_of_week.is.null,day_of_week.eq.${isoWeekday}`);
      if (cancelled) return;
      if (!templates || templates.length === 0) {
        setStats([]);
        return;
      }

      const { data: completions } = await supabase
        .from('staff_duty_completions')
        .select('template_id, completed, completed_at')
        .eq('duty_date', todayStr)
        .in(
          'template_id',
          templates.map((t) => t.id)
        );
      if (cancelled) return;

      const completedByTemplate = new Map((completions ?? []).filter((c) => c.completed).map((c) => [c.template_id, c.completed_at]));

      const byKey = new Map<string, RosterStat>();
      for (const t of templates) {
        const key = t.staff_roster_key ?? 'unassigned';
        const entry = byKey.get(key) ?? { key, total: 0, done: 0, lastCompletedAt: null };
        entry.total += 1;
        const completedAt = completedByTemplate.get(t.id);
        if (completedAt) {
          entry.done += 1;
          if (!entry.lastCompletedAt || completedAt > entry.lastCompletedAt) entry.lastCompletedAt = completedAt;
        }
        byKey.set(key, entry);
      }
      setStats([...byKey.values()].sort((a, b) => b.total - a.total));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (stats === null || stats.length === 0) return null;

  const totalDuties = stats.reduce((sum, s) => sum + s.total, 0);
  const totalDone = stats.reduce((sum, s) => sum + s.done, 0);
  const pct = totalDuties > 0 ? Math.round((totalDone / totalDuties) * 100) : 0;
  const overallLastCompletedAt = stats.reduce<string | null>(
    (latest, s) => (s.lastCompletedAt && (!latest || s.lastCompletedAt > latest) ? s.lastCompletedAt : latest),
    null
  );

  return (
    <div className="bg-card rounded-xl2 shadow-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="font-display text-lg text-denim">Today's Duties</h3>
        <span className="text-sm font-semibold text-brass">
          {totalDone}/{totalDuties} · {pct}%
        </span>
      </div>
      <p className="text-xs text-dusk mb-3">{formatTime(overallLastCompletedAt)}</p>
      <ul className="space-y-1.5">
        {stats.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 bg-mist rounded-xl px-3 py-2">
            <span className="text-sm text-denim">{ROSTER_LABELS[s.key] ?? s.key}</span>
            <span className={`text-xs font-medium ${s.done === s.total ? 'text-sage' : 'text-dusk'}`}>
              {s.done}/{s.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
