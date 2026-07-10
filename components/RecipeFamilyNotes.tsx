// components/RecipeFamilyNotes.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeFamilyNotes } from '@/app/recipes/actions';
import { useToast } from '@/components/Toast';

export default function RecipeFamilyNotes({
  recipeId,
  initialNotes,
}: {
  recipeId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const t = useTranslations('recipeCards.familyNotes');
  const tc = useTranslations('common');

  const isDirty = notes.trim() !== saved.trim();

  function handleSave() {
    startTransition(async () => {
      const result = await updateRecipeFamilyNotes({ recipeId, notes: notes.trim() });
      if (result.success) {
        setSaved(notes.trim());
        showToast(t('savedToast'), { variant: 'success' });
      } else {
        showToast(result.error ?? t('errorToast'), { variant: 'error' });
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 print:hidden">
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-2">{t('description')}</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isPending}
        rows={3}
        placeholder={t('placeholder')}
        className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl p-3 text-sm text-charcoal disabled:opacity-60 resize-y"
      />
      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button
            onClick={() => setNotes(saved)}
            className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5"
          >
            {tc('revert')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-charcoal text-cream px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </div>
  );
}
