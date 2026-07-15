// components/PrepAheadAssistant.tsx
// Freezer-triggered reminder list -- deliberately display-only, never writes
// staff_tasks (a separate, already-real task-management surface). Toggle is
// a real persisted properties.feature_flags.prep_ahead_assistant write, same
// read-then-merge convention as every other flag on this column, not a
// session preference.
'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Snowflake } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

type Reminder = { recipeName: string; planDate: string; prepLeadDays: number | null };

export default function PrepAheadAssistant({
  propertyId,
  initialEnabled,
  reminders,
  canManage,
}: {
  propertyId: string;
  initialEnabled: boolean;
  reminders: Reminder[];
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const showToast = useToast();

  async function setPrepAheadEnabled(next: boolean) {
    setSaving(true);
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (current?.feature_flags ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from('properties')
      .update({ feature_flags: { ...flags, prep_ahead_assistant: next } })
      .eq('id', propertyId);
    setSaving(false);
    if (error) {
      showToast('Failed to update Prep Ahead Assistant setting.', { variant: 'error' });
      return;
    }
    setEnabled(next);
    showToast(next ? 'Prep Ahead Assistant turned on.' : 'Prep Ahead Assistant turned off.', { variant: 'success' });
  }

  // Staff shouldn't see a disabled property-wide setting or a control to
  // change it -- nothing to render for them once it's off.
  if (!enabled && !canManage) return null;

  if (!enabled) {
    return (
      <div className="rounded-2xl p-4 mb-8 bg-cream border border-gold-light/40 flex items-center justify-between gap-3">
        <p className="text-sm text-charcoal/50">Prep Ahead Assistant is off.</p>
        <button
          onClick={() => setPrepAheadEnabled(true)}
          disabled={saving}
          className="text-xs font-medium text-gold-dark underline disabled:opacity-40 shrink-0"
        >
          Turn on
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-display text-charcoal flex items-center gap-1.5">
          <Snowflake size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> Prep Ahead Assistant
        </h2>
        {canManage && (
          <button
            onClick={() => setPrepAheadEnabled(false)}
            disabled={saving}
            className="text-xs text-charcoal/40 underline disabled:opacity-40 shrink-0"
          >
            Turn off
          </button>
        )}
      </div>
      {reminders.length === 0 ? (
        <p className="text-sm text-charcoal/60">Nothing freezer-friendly needs pulling ahead in the next few days.</p>
      ) : (
        <ul className="space-y-1.5">
          {reminders.map((r, i) => (
            <li key={i} className="text-sm text-charcoal/80">
              <span className="font-medium">{r.recipeName}</span> — freezer-friendly, scheduled{' '}
              {format(parseISO(r.planDate), 'EEEE, MMM d')}
              {r.prepLeadDays ? `; start prep ${r.prepLeadDays} day${r.prepLeadDays === 1 ? '' : 's'} ahead` : ' — pull it out ahead of time'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
