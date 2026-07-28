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
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
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
  const es = locale === 'es';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
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
      showToast(es ? 'No has iniciado sesión.' : 'Not signed in.', { variant: 'error' });
      return;
    }
    const { data, error } = await supabase
      .from('shifts')
      .insert({ property_id: propertyId, user_id: user.id, clocked_in_at: new Date().toISOString() })
      .select('id, clocked_in_at')
      .single();
    setBusy(false);
    if (error || !data) {
      showToast(es ? 'No se pudo registrar la entrada.' : 'Could not clock in.', { variant: 'error' });
      return;
    }
    setOpenShift(data as OpenShift);
    showToast(es ? 'Entrada registrada.' : 'Clocked in.', { variant: 'success' });
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
      showToast(es ? 'No se pudo registrar la salida.' : 'Could not clock out.', { variant: 'error' });
      return;
    }
    const worked = formatElapsed(openShift.clocked_in_at, Date.now());
    setOpenShift(null);
    showToast(es ? `Salida registrada — ${worked}.` : `Clocked out — ${worked}.`, { variant: 'success' });
  }

  // No skeleton: this is one small control, and a placeholder pill that
  // swaps to a different label reads as a flicker rather than as loading.
  if (loading) return null;

  const clockedIn = openShift !== null;

  return (
    <button
      onClick={clockedIn ? clockOut : clockIn}
      disabled={busy}
      aria-pressed={clockedIn}
      // D-18: the active/selected state is bg-denim with white text. The
      // idle state is the outlined counterpart, not brass -- brass is
      // never a fill (D-01).
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
        clockedIn
          ? 'bg-denim text-white hover:opacity-90'
          : 'bg-mist text-denim border border-brass/40 hover:bg-card'
      }`}
    >
      {clockedIn ? (
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
      {busy
        ? es
          ? 'Guardando…'
          : 'Saving…'
        : clockedIn
        ? `${es ? 'Marcar salida' : 'Clock Out'} · ${formatElapsed(openShift.clocked_in_at, now)}`
        : es
        ? 'Marcar entrada'
        : 'Clock In'}
    </button>
  );
}
