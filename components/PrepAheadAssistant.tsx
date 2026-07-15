// components/PrepAheadAssistant.tsx
// Freezer-triggered reminder list -- deliberately display-only, never writes
// staff_tasks (a separate, already-real task-management surface). Toggle is
// a real persisted properties.feature_flags.prep_ahead_assistant write, same
// read-then-merge convention as every other flag on this column, not a
// session preference.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Snowflake } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

type Reminder = { recipeId: string | null; recipeName: string; planDate: string; prepLeadDays: number | null };

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
  const [collapsed, setCollapsed] = useState(false);
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
      <div className="py-3.5 border-t border-line flex items-center justify-between gap-3">
        <p className="text-sm text-muted2">Prep Ahead Assistant is off.</p>
        <button
          onClick={() => setPrepAheadEnabled(true)}
          disabled={saving}
          className="text-xs font-bold text-gold-dark underline disabled:opacity-40 shrink-0"
        >
          Turn on
        </button>
      </div>
    );
  }

  // Bold Direction (Home only): the mockup's .collapsed-row treatment --
  // a plain border-top/bottom row with an uppercase label, count, and
  // chevron, not a bordered gold card.
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 py-3.5 border-t border-line">
        <button onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-2 text-left">
          <Snowflake size={14} strokeWidth={2} className="text-gold-dark" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink">Prep Ahead Assistant</span>
          <span className="text-xs text-muted2 font-bold">({reminders.length})</span>
          <span className="text-muted2 text-sm">{collapsed ? '▸' : '▾'}</span>
        </button>
        {canManage && (
          <button
            onClick={() => setPrepAheadEnabled(false)}
            disabled={saving}
            className="text-xs text-muted2 underline disabled:opacity-40 shrink-0"
          >
            Turn off
          </button>
        )}
      </div>
      {!collapsed && (
        reminders.length === 0 ? (
          <p className="text-sm text-muted2 pb-2">Nothing freezer-friendly needs pulling ahead in the next few days.</p>
        ) : (
          <ul className="space-y-1.5 pb-2">
            {reminders.map((r, i) => (
              <li key={i} className="text-sm text-ink-soft">
                {r.recipeId ? (
                  <Link
                    href={`/properties/${propertyId}/recipes/${r.recipeId}`}
                    className="font-semibold underline decoration-line decoration-2 underline-offset-2 hover:text-gold-dark"
                  >
                    {r.recipeName}
                  </Link>
                ) : (
                  <span className="font-semibold">{r.recipeName}</span>
                )}
                {' '}— freezer-friendly, scheduled{' '}
                {format(parseISO(r.planDate), 'EEEE, MMM d')}
                {r.prepLeadDays ? `; start prep ${r.prepLeadDays} day${r.prepLeadDays === 1 ? '' : 's'} ahead` : ' — pull it out ahead of time'}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
