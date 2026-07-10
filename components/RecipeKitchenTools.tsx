// components/RecipeKitchenTools.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateRecipeEquipment } from '@/app/recipes/actions';
import { createClient } from '@/lib/supabase/client';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

type ToolRow = { id: string; name: string };
type OwnershipRow = { tool_id: string; owned: boolean };

export default function RecipeKitchenTools({
  recipeId,
  propertyId,
  initialEquipment,
}: {
  recipeId: string;
  propertyId: string;
  initialEquipment: string[];
}) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [saved, setSaved] = useState(initialEquipment);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [ownership, setOwnership] = useState<Record<string, boolean>>({}); // tool_id -> owned
  const [addingToList, setAddingToList] = useState(false);
  const showToast = useToast();
  const t = useTranslations('recipeCards.kitchenTools');
  const tc = useTranslations('common');
  const supabase = createClient();

  const isDirty = JSON.stringify(equipment) !== JSON.stringify(saved);

  useEffect(() => {
    (async () => {
      const [{ data: allTools }, { data: ownedRows }] = await Promise.all([
        supabase.from('kitchen_tools').select('id, name'),
        supabase.from('household_tool_ownership').select('tool_id, owned').eq('property_id', propertyId),
      ]);
      setTools(allTools ?? []);
      const byTool: Record<string, boolean> = {};
      for (const row of (ownedRows as OwnershipRow[]) ?? []) byTool[row.tool_id] = row.owned;
      setOwnership(byTool);
    })();
  }, [propertyId, supabase]);

  // Every equipment name this recipe needs, matched to its canonical tool
  // row via a plain lower(trim()) equality -- not similarity/fuzzy matching
  // (see the migration's own comment on why that's deliberately avoided
  // here). Unmatched names (e.g. a brand-new one just added via the chip
  // input, not yet in the dictionary) show with no ownership toggle until
  // the recipe is saved, which upserts them into kitchen_tools.
  const matchedTools = equipment
    .map((name) => tools.find((tl) => tl.name.toLowerCase() === name.trim().toLowerCase()))
    .filter((t): t is ToolRow => !!t);
  const ownedCount = matchedTools.filter((tl) => ownership[tl.id]).length;
  const missingTools = matchedTools.filter((tl) => !ownership[tl.id]);

  async function toggleOwned(tool: ToolRow) {
    const nextOwned = !ownership[tool.id];
    setOwnership((prev) => ({ ...prev, [tool.id]: nextOwned }));
    const { error } = await supabase
      .from('household_tool_ownership')
      .upsert(
        { property_id: propertyId, tool_id: tool.id, owned: nextOwned, updated_at: new Date().toISOString() },
        { onConflict: 'property_id,tool_id' }
      );
    if (error) {
      setOwnership((prev) => ({ ...prev, [tool.id]: !nextOwned }));
      showToast(t('errorToast'), { variant: 'error' });
    }
  }

  async function addMissingToList() {
    if (missingTools.length === 0) return;
    setAddingToList(true);
    const result = await addIngredientsToShoppingList(
      supabase,
      propertyId,
      missingTools.map((tl) => ({ name: tl.name, category: 'Kitchen Tools', quantity: 1, unit: null, recipe_id: recipeId }))
    );
    setAddingToList(false);
    if (!result.ok) {
      showToast(result.error, { variant: 'error' });
      return;
    }
    showToast(t('addedToListToast', { count: result.count }), { variant: 'success' });
  }

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
        // Keep the tools dictionary self-expanding: any equipment name that
        // isn't already a canonical tool gets added (exact name, no fuzzy
        // matching), so ownership tracking becomes available for it too.
        const newNames = equipment.filter(
          (name) => !tools.some((tl) => tl.name.toLowerCase() === name.trim().toLowerCase())
        );
        if (newNames.length > 0) {
          const { data: inserted, error: toolsError } = await supabase
            .from('kitchen_tools')
            .upsert(
              newNames.map((name) => ({ name: name.trim() })),
              { onConflict: 'name', ignoreDuplicates: true }
            )
            .select('id, name');
          // Best-effort: the recipe's own equipment save above already
          // succeeded and already showed its own toast, so a failure here
          // (e.g. a future RLS change) is logged, not surfaced as a second
          // user-facing error for a secondary enhancement.
          if (toolsError) console.error('Failed to add new tool to kitchen_tools dictionary:', toolsError);
          if (inserted && inserted.length > 0) setTools((prev) => [...prev, ...inserted]);
        }
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

      {matchedTools.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gold-light/40">
          <p className="text-xs font-medium text-charcoal mb-2">
            {t('ownedSummary', { owned: ownedCount, total: matchedTools.length })}
            {ownedCount === matchedTools.length ? ` · ${t('readyForPrep')}` : ''}
          </p>
          <ul className="space-y-1.5 mb-3">
            {matchedTools.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between text-sm">
                <span className="text-charcoal">{tool.name}</span>
                <button
                  onClick={() => toggleOwned(tool)}
                  className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                    ownership[tool.id]
                      ? 'bg-sage/15 text-sage'
                      : 'bg-cream border border-gold-light/60 text-charcoal/60'
                  }`}
                >
                  {ownership[tool.id] ? t('owned') : t('notOwned')}
                </button>
              </li>
            ))}
          </ul>
          {missingTools.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                onClick={addMissingToList}
                disabled={addingToList}
                className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40 self-start"
              >
                {addingToList ? tc('saving') : t('addAllToPrepList', { count: missingTools.length })}
              </button>
              <Link href={`/properties/${propertyId}/shopping-list`} className="text-xs text-charcoal/40 underline self-start">
                {t('customizePrepList')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
