// components/ConsoleLeadsCard.tsx
// Leads backup fold (Racquel's 2 Aug ruling): the consultation requests
// that land in consultation_requests, surfaced owner-only in the
// console. COLLAPSIBLE and default-collapsed with an unread badge --
// "Racquel can expand when she wants it and it stays out of her way
// otherwise." The badge counts read_at IS NULL rows and shows regardless
// of whether the Resend notification email worked -- that failure mode
// is the point of this fold. Expanding marks the visible leads read.
// English-only (SS-436 carve-out).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  service_interest: string[] | null;
  notes: string | null;
  heard_about: string | null;
  created_at: string;
  read_at: string | null;
};

export default function ConsoleLeadsCard() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  const loadUnread = useCallback(async () => {
    const { count } = await supabase
      .from('consultation_requests')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    setUnread(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && leads === null) {
      const { data } = await supabase
        .from('consultation_requests')
        .select('id, name, phone, email, service_interest, notes, heard_about, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setLeads(data ?? []);
      const unreadIds = (data ?? []).filter((l) => !l.read_at).map((l) => l.id);
      if (unreadIds.length) {
        await supabase.from('consultation_requests').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
        setUnread(0);
      }
    }
  }

  return (
    <div className="border border-cardBorder rounded-xl2 bg-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-denim">Consultation leads</span>
          {unread !== null && unread > 0 && (
            <span className="text-[11px] font-semibold text-white bg-rust rounded-full px-2 py-0.5">
              {unread} new
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-dusk transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-cardBorder/60 px-4 py-3">
          <p className="text-xs text-dusk mb-2">
            Every Book Your Consultation submission, newest first -- stored before any notification email is
            attempted, so this list is complete even when the email fails.
          </p>
          {leads === null ? (
            <p className="text-xs text-dusk">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="text-xs text-dusk">No leads yet.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {leads.map((l) => (
                <li key={l.id} className="border-b border-cardBorder/60 pb-2.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-denim">{l.name}</span>
                    <span className="text-[11px] text-dusk shrink-0">
                      {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-denim mt-0.5">
                    <a href={`tel:${l.phone}`} className="underline underline-offset-2">
                      {l.phone}
                    </a>{' '}
                    ·{' '}
                    <a href={`mailto:${l.email}`} className="underline underline-offset-2">
                      {l.email}
                    </a>
                  </p>
                  {(l.service_interest?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-dusk mt-0.5">{l.service_interest!.join(', ')}</p>
                  )}
                  {l.notes && <p className="text-xs text-dusk mt-0.5">{l.notes}</p>}
                  {l.heard_about && <p className="text-[11px] text-dusk mt-0.5">Heard via: {l.heard_about}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
