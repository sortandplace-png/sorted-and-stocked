// components/RecipeBracha.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeBrachaCategory, suggestRecipeBrachaCategory } from '@/app/recipes/actions';
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
  // The suggestion is only ever a starting point, never applied silently --
  // it pre-fills `selected` (so it's visible and one Save away from being
  // real) but never `saved`, so it can never look confirmed until someone
  // actually confirms it.
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
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
  // -- never override an existing manual choice, even an old one.
  useEffect(() => {
    if (initialCategory !== null) return;
    suggestRecipeBrachaCategory(recipeId).then((suggestion) => {
      if (!suggestion) return;
      setSuggestedCategory(suggestion);
      setSelected((current) => (current === null ? suggestion : current));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const isDirty = selected !== saved;
  const selectedRow = categories.find((c) => c.category === selected);
  const isUnconfirmedSuggestion = isDirty && selected !== null && selected === suggestedCategory;

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
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-2">{t('description')}</p>

      <select
        value={selected ?? ''}
        onChange={(e) => setSelected(e.target.value || null)}
        disabled={isPending}
        className={`w-full border focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl p-2.5 text-sm text-charcoal disabled:opacity-60 bg-white ${
          isUnconfirmedSuggestion ? 'border-dashed border-gold' : 'border-gold-light/60 focus:border-gold'
        }`}
      >
        <option value="">{t('notSet')}</option>
        {categories.map((c) => (
          <option key={c.category} value={c.category}>
            {titleCase(c.category)} — {c.bracha_rishona}
          </option>
        ))}
      </select>

      {/* Dashed border above + this line together mark an unsaved AI
          suggestion. The instant it's saved, saved === selected, this
          disappears, and the achrona preview below renders identically to
          any manually-chosen bracha -- confirmed is confirmed, regardless
          of where the pick came from. */}
      {isUnconfirmedSuggestion && (
        <p className="mt-1.5 text-xs font-medium text-gold-dark">💡 AI suggestion — tap Save to confirm</p>
      )}

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="mt-1.5 text-xs text-charcoal/40 underline"
      >
        {t('notSureLink')}
      </button>
      {showHelp && (
        <p className="mt-1 text-xs text-charcoal/60 bg-cream px-3 py-2 rounded-lg">{t('notSureHelp')}</p>
      )}

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

      {selected && selected === saved && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg">
          {needsSourcing ? (
            <div className="bg-rust/10 text-rust font-medium px-3 py-2 -mx-3 -my-2 rounded-lg">
              ⚠️ {t('needsSourcing')}
            </div>
          ) : achrona ? (
            <div className="bg-sage/10 text-charcoal px-3 py-2 -mx-3 -my-2 rounded-lg">
              <span className="font-medium">{t('achronaLabel')}</span> {achrona}
              {achronaNote && <div className="italic text-charcoal/60 pt-1">{achronaNote}</div>}
            </div>
          ) : null}
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
          className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </div>
  );
}
