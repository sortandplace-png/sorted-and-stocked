// components/PrepAheadAssistant.tsx
// Freezer-triggered reminder list -- deliberately display-only, never writes
// staff_tasks (a separate, already-real task-management surface). Toggle is
// a real persisted properties.feature_flags.prep_ahead_assistant write, same
// read-then-merge convention as every other flag on this column, not a
// session preference.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { Snowflake } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import Pin from '@/components/PinAccent';

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
  const t = useTranslations('dashboard.prepAhead');
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
      showToast(t('failedToUpdate'), { variant: 'error' });
      return;
    }
    setEnabled(next);
    showToast(next ? t('turnedOn') : t('turnedOff'), { variant: 'success' });
  }

  // Staff shouldn't see a disabled property-wide setting or a control to
  // change it -- nothing to render for them once it's off.
  if (!enabled && !canManage) return null;

  if (!enabled) {
    return (
      <div className="relative rounded-xl2 border border-brass/30 bg-mist shadow-card py-[14px] px-[18px] mb-4 flex items-center justify-between gap-3">
        <Pin size="sm" />
        <p className="text-sm text-dusk">{t('off')}</p>
        <button
          onClick={() => setPrepAheadEnabled(true)}
          disabled={saving}
          className="text-xs font-bold text-brass underline disabled:opacity-40 shrink-0"
        >
          {t('turnOn')}
        </button>
      </div>
    );
  }

  // Restyled to match the widget system exactly (mist fill, brass/30
  // border, rounded-xl2, brass pin dot, brass eyebrow) -- was still on the
  // old rounded-xl3/bg-card/cardBorder shell from the pre-widget-redesign
  // "New direction" pass.
  return (
    <div className="relative rounded-xl2 border border-brass/30 bg-mist shadow-card py-[14px] px-[18px] mb-4">
      <Pin size="sm" />
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-2 text-left">
          <Snowflake size={14} strokeWidth={2} className="text-brass" aria-hidden="true" />
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('title')}</span>
          <span className="text-xs text-dusk font-bold">({reminders.length})</span>
          <span className="text-dusk text-sm">{collapsed ? '▸' : '▾'}</span>
        </button>
        {canManage && (
          <button
            onClick={() => setPrepAheadEnabled(false)}
            disabled={saving}
            className="text-xs text-dusk underline disabled:opacity-40 shrink-0"
          >
            {t('turnOff')}
          </button>
        )}
      </div>
      {!collapsed && (
        reminders.length === 0 ? (
          <p className="text-sm text-dusk pt-3">{t('nothingUpcoming')}</p>
        ) : (
          <ul className="space-y-1.5 pt-3">
            {reminders.map((r, i) => (
              <li key={i} className="text-sm text-denim">
                {r.recipeId ? (
                  <Link
                    href={`/properties/${propertyId}/recipes/${r.recipeId}`}
                    className="font-semibold underline decoration-cardBorder decoration-2 underline-offset-2 hover:text-brass"
                  >
                    {r.recipeName}
                  </Link>
                ) : (
                  <span className="font-semibold">{r.recipeName}</span>
                )}
                {' '}— {t('freezerFriendlyScheduled')}{' '}
                {format(parseISO(r.planDate), 'EEEE, MMM d')}
                {r.prepLeadDays ? `; ${t('startPrep')} ${r.prepLeadDays} ${r.prepLeadDays === 1 ? t('day') : t('days')} ${t('ahead')}` : ` — ${t('pullOutAhead')}`}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
