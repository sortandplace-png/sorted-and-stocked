// components/TeamOnShiftBar.tsx
// Who is on shift right now, as a thin strip on My Day. First names and a
// dot -- enough to know you are not alone in the house, and to know who to
// go and find.
//
// WHO, never WHAT. No join to tasks, no task counts, nothing task-level.
// Staff task visibility is already restricted at the RLS layer (SS-211);
// this component doesn't relax that and must not grow a "working on…"
// column later without that being a deliberate, separate decision.
//
// Renders nothing at all when nobody is clocked in -- an empty bar reading
// "nobody is working" is a worse thing to show a lone housekeeper than no
// bar at all.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

type OpenShift = { user_id: string; clocked_in_at: string };

/** "Maria Elena Ruiz" -> "Maria". A rota is read at a glance. */
function firstName(full: string | null): string | null {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

export default function TeamOnShiftBar({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const locale = useLocale();
  const es = locale === 'es';
  const [names, setNames] = useState<string[]>([]);

  const load = useCallback(async () => {
    // Two queries, not an embedded select. shifts has exactly one foreign
    // key -- property_id -> properties -- and none on user_id, so
    // .select('user_id, profiles(full_name)') has no relationship to
    // resolve and fails rather than silently returning nulls. Names come
    // from property_members, same as ShiftHoursClient does it.
    const { data: openShifts } = await supabase
      .from('shifts')
      .select('user_id, clocked_in_at')
      .eq('property_id', propertyId)
      .is('clocked_out_at', null);

    const shiftRows = (openShifts as OpenShift[]) ?? [];
    if (shiftRows.length === 0) {
      setNames([]);
      return;
    }

    const { data: memberRows } = await supabase
      .from('property_members')
      .select('user_id, profiles(full_name)')
      .eq('property_id', propertyId);

    const nameByUser = new Map(
      (memberRows ?? []).map((m) => [
        m.user_id,
        (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
      ])
    );

    // Deduped by user: someone with two open rows (a forgotten clock-out
    // plus a fresh one) is still one person standing in the house, and
    // should appear once.
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of shiftRows) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      const name = firstName(nameByUser.get(s.user_id) ?? null);
      // Someone clocked in whose profile has no name is still someone
      // working -- counted under a neutral label rather than dropped.
      list.push(name ?? (es ? 'Alguien' : 'Someone'));
    }
    setNames(list.sort((a, b) => a.localeCompare(b)));
  }, [propertyId, supabase, es]);

  useEffect(() => {
    load();
  }, [load]);

  // The whole point of the empty state is that there isn't one.
  if (names.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl2 bg-mist border border-brass/30 px-3 py-2 mb-5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
        {es ? 'En turno' : 'On shift'}
      </span>
      {names.map((n) => (
        <span
          key={n}
          className="inline-flex items-center gap-1.5 text-xs text-denim"
        >
          {/* Sage, not brass -- brass is never a fill (D-01), and this dot
              is a filled dot by definition. */}
          <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
          {n}
        </span>
      ))}
    </div>
  );
}
