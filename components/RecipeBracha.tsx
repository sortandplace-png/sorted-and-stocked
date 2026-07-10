// components/RecipeBracha.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeBrachaCategory } from '@/app/recipes/actions';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

interface BrachaCategoryRow {
  category: string;
  bracha_rishona: string;
  bracha_achrona: string;
  note: string | null;
}

// Categories are a human title, not a raw db key (e.g. "grain_mezonos" ->
// "Grain Mezonos") -- derived from the row itself rather than a separate
// hardcoded label map, so this never drifts from bracha_categories. Left
// untranslated in both locales on purpose -- these are halachic terms
// (Hamotzi, Mezonos, etc.), same treatment as Shabbos/Parve.
function titleCase(key: string) {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function RecipeBracha({
  recipeId,
  initialCategory,
}: {
  recipeId: string;
  initialCategory: string | null;
}) {
  const [categories, setCategories] = useState<BrachaCategoryRow[]>([]);
  const [selected, setSelected] = useState<string | null>(initialCategory);
  const [saved, setSaved] = useState<string | null>(initialCategory);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const t = useTranslations('recipeCards.bracha');
  const tc = useTranslations('common');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('bracha_categories')
      .select('category, bracha_rishona, bracha_achrona, note')
      .order('category')
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const isDirty = selected !== saved;
  const selectedRow = categories.find((c) => c.category === selected);

  function handleSave() {
    startTransition(async () => {
      const result = await updateRecipeBrachaCategory({ recipeId, brachaCategory: selected });
      if (result.success) {
        setSaved(selected);
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

      <select
        value={selected ?? ''}
        onChange={(e) => setSelected(e.target.value || null)}
        disabled={isPending}
        className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl p-2.5 text-sm text-charcoal disabled:opacity-60 bg-white"
      >
        <option value="">{t('notSet')}</option>
        {categories.map((c) => (
          <option key={c.category} value={c.category}>
            {titleCase(c.category)} — {c.bracha_rishona}
          </option>
        ))}
      </select>

      {selectedRow && (
        <div className="mt-2 text-xs text-charcoal/60 bg-cream px-3 py-2 rounded-lg space-y-0.5">
          <div>
            <span className="font-medium text-charcoal">{t('before')}</span> {selectedRow.bracha_rishona}
          </div>
          <div>
            <span className="font-medium text-charcoal">{t('after')}</span> {selectedRow.bracha_achrona}
          </div>
          {selectedRow.note && <div className="italic pt-1">{selectedRow.note}</div>}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button
            onClick={() => setSelected(saved)}
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
