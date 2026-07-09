// components/RecipePrepLeadDays.tsx
// v1 of the prep-timeline idea: a single lead-time number per recipe rather
// than a full backwards-scheduling engine. "2" means the dashboard should
// remind 2 days before plan_date — e.g. "move chicken from freezer to
// fridge" for a Friday dinner needs a Wednesday nudge.
'use client';

import { useState, useTransition } from 'react';
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

  const isDirty = days.trim() !== saved.trim();

  function handleSave() {
    startTransition(async () => {
      const parsed = days.trim() ? Number(days.trim()) : null;
      const result = await updateRecipePrepLeadDays({ recipeId, prepLeadDays: parsed });
      if (result.success) {
        setSaved(days.trim());
        showToast('Prep lead time saved.', { variant: 'success' });
      } else {
        showToast(result.error ?? 'Failed to save.', { variant: 'error' });
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 print:hidden">
      <h3 className="font-display text-lg text-charcoal mb-1">Prep lead time</h3>
      <p className="text-xs text-charcoal/50 mb-2">
        Days of head start this recipe needs (e.g. moving meat from freezer to fridge) — shows as a dashboard
        reminder before the day it's planned.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={14}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          disabled={isPending}
          placeholder="e.g. 2"
          className="w-24 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl px-3 py-2 text-sm text-charcoal disabled:opacity-60"
        />
        <span className="text-sm text-charcoal/50">day{days.trim() === '1' ? '' : 's'} ahead</span>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button onClick={() => setDays(saved)} className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5">
            Revert
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-charcoal text-cream px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
