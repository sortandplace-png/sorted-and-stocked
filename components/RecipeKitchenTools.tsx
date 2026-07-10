// components/RecipeKitchenTools.tsx
'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateRecipeEquipment } from '@/app/recipes/actions';
import { useToast } from '@/components/Toast';

export default function RecipeKitchenTools({
  recipeId,
  initialEquipment,
}: {
  recipeId: string;
  initialEquipment: string[];
}) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [saved, setSaved] = useState(initialEquipment);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const t = useTranslations('recipeCards.kitchenTools');
  const tc = useTranslations('common');

  const isDirty = JSON.stringify(equipment) !== JSON.stringify(saved);

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed || equipment.some((e) => e.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    setEquipment((prev) => [...prev, trimmed]);
    setDraft('');
  }

  function removeItem(item: string) {
    setEquipment((prev) => prev.filter((e) => e !== item));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateRecipeEquipment({ recipeId, equipment });
      if (result.success) {
        setSaved(equipment);
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

      {equipment.length === 0 && !isPending && (
        <p className="text-sm text-charcoal/40 mb-2">{t('empty')}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {equipment.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 text-xs font-medium text-charcoal bg-gold-light/30 border border-gold-light/50 pl-2.5 pr-1 py-1 rounded-full"
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              disabled={isPending}
              aria-label={t('remove', { item })}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-charcoal/10 transition"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          disabled={isPending}
          placeholder={t('placeholder')}
          className="flex-1 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl px-3 py-1.5 text-sm text-charcoal disabled:opacity-60"
        />
        <button
          onClick={addItem}
          disabled={isPending || !draft.trim()}
          className="text-sm font-medium text-gold-dark border border-gold-light/60 px-3 py-1.5 rounded-xl disabled:opacity-40"
        >
          {t('addButton')}
        </button>
      </div>

      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button
            onClick={() => setEquipment(saved)}
            className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5"
          >
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
