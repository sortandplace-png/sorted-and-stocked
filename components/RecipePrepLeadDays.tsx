// components/RecipePrepLeadDays.tsx
// v1 of the prep-timeline idea: a single lead-time number per recipe rather
// than a full backwards-scheduling engine. "2" means the dashboard should
// remind 2 days before plan_date — e.g. "move chicken from freezer to
// fridge" for a Friday dinner needs a Wednesday nudge.
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipePrepLeadDays } from '@/app/recipes/actions';
import { useToast } from '@/components/Toast';

export default function RecipePrepLeadDays({
  recipeId,
  initialDays,
}: {
  recipeId: string;
  initialDays: number | null;
}) {
  const [days, setDays] = useState(initialDays !== null ? String(initialDays) : '');
  const [saved, setSaved] = useState(initialDays !== null ? String(initialDays) : '');
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const t = useTranslations('recipeCards.prepLeadDays');
  const tc = useTranslations('common');

  const isDirty = days.trim() !== saved.trim();

  function handleSave() {
    startTransition(async () => {
      const parsed = days.trim() ? Number(days.trim()) : null;
      const result = await updateRecipePrepLeadDays({ recipeId, prepLeadDays: parsed });
      if (result.success) {
        setSaved(days.trim());
        showToast(t('savedToast'), { variant: 'success' });
      } else {
        showToast(result.error ?? t('errorToast'), { variant: 'error' });
      }
    });
  }

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:hidden">
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-2">{t('description')}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={14}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          disabled={isPending}
          placeholder={t('placeholder')}
          className="w-24 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl px-3 py-2 text-sm text-charcoal disabled:opacity-60"
        />
        <span className="text-sm text-charcoal/50">
          {days.trim() === '1' ? t('daysAheadSingular') : t('daysAheadPlural')}
        </span>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button onClick={() => setDays(saved)} className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5">
            {tc('revert')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </div>
  );
}
