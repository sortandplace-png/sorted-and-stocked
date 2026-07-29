// components/ClockInOutButton.tsx
// SS-285: one pill at the top of My Day. Not clocked in -> "Clock In".
// Clocked in -> "Clock Out" with the elapsed time running.
//
// Deliberately the whole feature: no location check, no breaks, no pay
// rate, no export. Confirmed out of scope again 28 Jul, and the value of
// this is that a housekeeper can start and end a shift in one tap without
// being interrogated by a form.
//
// RLS backs all of it (verified live): shifts_insert_self requires
// user_id = auth.uid() AND membership, shifts_update allows the owner of
// the row or a manager, shifts_read is any property member. Nothing here
// relies on the client being honest about whose shift it is.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import Tile from '@/components/ui/Tile';
import { LogIn, LogOut } from 'lucide-react';

type OpenShift = { id: string; clocked_in_at: string };

/** "2h 14m", or "6m" under an hour. Seconds are noise on a shift. */
function formatElapsed(fromIso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ClockInOutButton({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const showToast = useToast();
  const locale = useLocale();
  const t = useTranslations('myDay');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  // Minutes completed this week, this person, this property. The /staff/hours
  // page answers "everyone, by week" for a manager; this answers "me, this
  // week" on the page the person actually opens, which is what Hours moving
  // to My Day means.
  const [weekMinutes, setWeekMinutes] = useState(0);
  // Ticks the elapsed label. Stored as a number rather than a formatted
  // string so the formatting stays in one place.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    // The open shift is the one with no clocked_out_at -- NOT "today's"
    // row. A shift started at 11pm and still running at 1am is the same
    // shift, and filtering by date would strand it open forever with no
    // way to close it from the UI.
    const { data } = await supabase
      .from('shifts')
      .select('id, clocked_in_at')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: false })
      .limit(1);
    setOpenShift((data?.[0] as OpenShift) ?? null);

    // Monday-start week, matching ShiftHoursClient so the two surfaces can
    // never disagree about which week you are in.
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const { data: weekRows } = await supabase
      .from('shifts')
      .select('clocked_in_at, clocked_out_at')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .gte('clocked_in_at', weekStart.toISOString());
    // Only closed shifts count. Counting the open one would make the weekly
    // total tick upward on its own and turn a forgotten clock-out into
    // hours nobody worked -- the same rule the manager view uses.
    const mins = ((weekRows as { clocked_in_at: string; clocked_out_at: string | null }[]) ?? [])
      .filter((s) => s.clocked_out_at)
      .reduce(
        (sum, s) =>
          sum + Math.max(0, (new Date(s.clocked_out_at as string).getTime() - new Date(s.clocked_in_at).getTime()) / 60000),
        0
      );
    setWeekMinutes(Math.round(mins));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Only runs while a shift is actually open, and only once a minute --
  // the label has minute resolution, so a faster tick would re-render for
  // nothing.
  useEffect(() => {
    if (!openShift) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [openShift]);

  async function clockIn() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      showToast(t('clockNotSignedIn'), { variant: 'error' });
      return;
    }
    const { data, error } = await supabase
      .from('shifts')
      .insert({ property_id: propertyId, user_id: user.id, clocked_in_at: new Date().toISOString() })
      .select('id, clocked_in_at')
      .single();
    setBusy(false);
    if (error || !data) {
      showToast(t('clockInFailed'), { variant: 'error' });
      return;
    }
    setOpenShift(data as OpenShift);
    showToast(t('clockedInToast'), { variant: 'success' });
  }

  async function clockOut() {
    if (!openShift) return;
    setBusy(true);
    // Targets the specific open row by id. Matching on "today + this user"
    // instead would be ambiguous the moment there are two rows, and would
    // quietly close the wrong one.
    const { error } = await supabase
      .from('shifts')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('id', openShift.id);
    setBusy(false);
    if (error) {
      showToast(t('clockOutFailed'), { variant: 'error' });
      return;
    }
    const worked = formatElapsed(openShift.clocked_in_at, Date.now());
    setOpenShift(null);
    showToast(t('clockedOutToast', { worked }), { variant: 'success' });
  }

  // No skeleton: this is one small control, and a placeholder that swaps to
  // a different label reads as a flicker rather than as loading.
  if (loading) return null;

  const clockedIn = openShift !== null;

  // SS-306: this was a pill at the top of My Day; it is now the fourth card
  // in the action grid, on the shared Tile. Nothing about the state, the
  // RLS-backed writes or the elapsed maths changed -- only what it looks
  // like. The scope guard in this file's header still stands: no location
  // check, no breaks, no pay rate, no export.
  //
  // Active face is denim with white text (D-18), which Tile owns; the pin
  // dot comes with the component rather than being added here.
  const subtitle = clockedIn
    ? t('sinceElapsed', {
        time: new Date(openShift.clocked_in_at).toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
        }),
        elapsed: formatElapsed(openShift.clocked_in_at, now),
      })
    : t('notClockedIn');

  return (
    <Tile
      centered
      active={clockedIn}
      disabled={busy}
      onClick={clockedIn ? clockOut : clockIn}
      eyebrow={t('timeClockEyebrow')}
      label={busy ? t('clockSaving') : clockedIn ? t('clockOut') : t('clockIn')}
      subtitle={subtitle}
      icon={
        clockedIn ? (
          <LogOut size={28} className="text-white" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <LogIn size={28} className="text-denim" strokeWidth={1.75} aria-hidden="true" />
        )
      }
    >
      {/* Hidden at zero rather than showing "0h 0m" -- on a Monday morning a
          zero total is noise, not information. */}
      {weekMinutes > 0 && (
        <span className={`text-[10px] ${clockedIn ? 'text-white/70' : 'text-dusk'}`}>
          {t('hoursThisWeek', {
            total: `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m`,
          })}
        </span>
      )}
    </Tile>
  );
}
