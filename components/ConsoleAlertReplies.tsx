// components/ConsoleAlertReplies.tsx
// SS-436 both-yes ruling (2 Aug, a): staff replies to alert texts,
// read-only, newest first, inside the console's PEOPLE fold. Data comes
// from sms_replies (migration 169), written only by the Twilio inbound
// webhook -- nothing here writes. English-only (SS-436 carve-out).
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Reply = {
  id: string;
  from_phone: string;
  body: string;
  received_at: string;
  matched_user_id: string | null;
};

export default function ConsoleAlertReplies({ propertyIds }: { propertyIds: string[] }) {
  const supabase = createClient();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (propertyIds.length === 0) {
      setReplies([]);
      return;
    }
    supabase
      .from('sms_replies')
      .select('id, from_phone, body, received_at, matched_user_id')
      .in('property_id', propertyIds)
      .order('received_at', { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        const rows = data ?? [];
        setReplies(rows);
        const userIds = [...new Set(rows.map((r) => r.matched_user_id).filter((u): u is string => !!u))];
        if (userIds.length) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
          setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? ''])));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyIds.join(',')]);

  return (
    <div className="border border-cardBorder rounded-xl2 bg-card p-4">
      <p className="text-sm font-medium text-denim">Alert replies</p>
      <p className="text-xs text-dusk mb-2">
        Texts staff send back to alert messages. Read-only, newest first. Nothing here yet means nobody has
        replied since this went live.
      </p>
      {replies === null ? (
        <p className="text-xs text-dusk">Loading…</p>
      ) : replies.length === 0 ? (
        <p className="text-xs text-dusk">No replies yet.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {replies.map((r) => (
            <li key={r.id} className="border-b border-cardBorder/60 pb-2 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-denim">
                  {(r.matched_user_id && names[r.matched_user_id]) || r.from_phone}
                </span>
                <span className="text-[11px] text-dusk shrink-0">
                  {new Date(r.received_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-denim mt-0.5">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
