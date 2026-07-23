// components/RecipeBracha.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeBrachaCategory, suggestRecipeBrachaCategory } from '@/app/recipes/actions';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import BrachaCategorySelect, { type BrachaCategoryRow } from '@/components/BrachaCategorySelect';

export default function RecipeBracha({
  recipeId,
  initialCategory,
  achrona: initialAchrona,
  achronaNote,
  needsSourcing: initialNeedsSourcing,
}: {
  recipeId: string;
  initialCategory: string | null;
  achrona: string | null;
  achronaNote: string | null;
  needsSourcing: boolean;
}) {
  const [categories, setCategories] = useState<BrachaCategoryRow[]>([]);
  const [selected, setSelected] = useState<string | null>(initialCategory);
  const [saved, setSaved] = useState<string | null>(initialCategory);
  const [showHelp, setShowHelp] = useState(false);
  // Kept in sync with the save response so the display doesn't go stale
  // after changing categories -- achrona is server-derived, not editable.
  const [achrona, setAchrona] = useState(initialAchrona);
  const [needsSourcing, setNeedsSourcing] = useState(initialNeedsSourcing);
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

  // Only offer a suggestion when nothing has ever been set for this recipe
  // -- never override an existing manual choice, even an old one. Per
  // Racquel's settled decision, the suggestion is saved immediately and
  // rendered through the exact same path as a manual choice -- selected and
  // saved are set together, so there is no separate "unconfirmed" state or
  // visual treatment anywhere in this component.
  useEffect(() => {
    if (initialCategory !== null) return;
    suggestRecipeBrachaCategory(recipeId).then(async (suggestion) => {
      if (!suggestion) return;
      const result = await updateRecipeBrachaCategory({ recipeId, brachaCategory: suggestion });
      if (result.success) {
        setSelected(suggestion);
        setSaved(suggestion);
        setAchrona(result.achrona ?? null);
        setNeedsSourcing(!!result.needsSourcing);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const isDirty = selected !== saved;
  const selectedRow = categories.find((c) => c.category === selected);

  function handleSave() {
    startTransition(async () => {
      const result = await updateRecipeBrachaCategory({ recipeId, brachaCategory: selected });
      if (result.success) {
        setSaved(selected);
        setAchrona(result.achrona ?? null);
        setNeedsSourcing(!!result.needsSourcing);
        showToast(t('savedToast'), { variant: 'success' });
      } else {
        showToast(result.error ?? t('errorToast'), { variant: 'error' });
      }
    });
  }

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:hidden">
      <h3 className="font-display text-lg text-denim mb-1">{t('title')}</h3>
      <p className="text-xs text-dusk mb-2">{t('description')}</p>

      <BrachaCategorySelect
        categories={categories}
        value={selected}
        onChange={setSelected}
        disabled={isPending}
        notSetLabel={t('notSet')}
      />

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="mt-1.5 text-xs text-dusk underline"
      >
        {t('notSureLink')}
      </button>
      {showHelp && (
        <p className="mt-1 text-xs text-dusk bg-linen px-3 py-2 rounded-lg">{t('notSureHelp')}</p>
      )}

      {selectedRow && (
        <div className="mt-2 text-xs text-dusk bg-linen px-3 py-2 rounded-lg space-y-0.5">
          <div>
            <span className="font-medium text-denim">{t('before')}</span> {selectedRow.bracha_rishona}
          </div>
          <div>
            <span className="font-medium text-denim">{t('after')}</span> {selectedRow.bracha_achrona}
          </div>
          {selectedRow.note && <div className="italic pt-1">{selectedRow.note}</div>}
        </div>
      )}

      {selected && selected === saved && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg">
          {needsSourcing ? (
            <div className="bg-rust/10 text-rust font-medium px-3 py-2 -mx-3 -my-2 rounded-lg">
              ⚠️ {t('needsSourcing')}
            </div>
          ) : achrona ? (
            <div className="bg-sage/10 text-denim px-3 py-2 -mx-3 -my-2 rounded-lg">
              <span className="font-medium">{t('achronaLabel')}</span> {achrona}
              {achronaNote && <div className="italic text-dusk pt-1">{achronaNote}</div>}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button
            onClick={() => setSelected(saved)}
            className="text-sm text-dusk hover:text-denim px-3 py-1.5"
          >
            {tc('revert')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </div>
  );
}
