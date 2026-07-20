// components/TranslationWorklistClient.tsx
// Same job as PhotoWorklistClient does for photos -- needs_translation is
// the real, already-maintained flag (set true whenever name_es is null;
// confirmed live it's not just derived on the fly), this is just the first
// place a manager can actually see and clear it, across all 3 tables that
// carry it (recipes, recipe_ingredients, inventory_items). Manager-only:
// this is a content-correctness worklist, not a staff task.
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { Languages } from 'lucide-react';

type WorklistRow = {
  id: string;
  table: 'recipes' | 'recipe_ingredients' | 'inventory_items';
  name: string;
  context: string | null;
};

export default function TranslationWorklistClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('translationWorklist');

  useEffect(() => {
    if (!canManage(role)) return;
    (async () => {
      // recipe_ingredients has no property_id of its own -- same two-step
      // (this property's recipe ids, then ingredients filtered to them)
      // NeedsLinkingClient.tsx already uses, rather than a fragile
      // triple-nested PostgREST filter.
      const { data: recipeRows } = await supabase
        .from('recipes')
        .select('id, name, needs_translation, recipe_property_links!inner(property_id)')
        .eq('recipe_property_links.property_id', propertyId);
      const recipeIds = (recipeRows ?? []).map((r) => r.id);
      const recipeNameById = new Map((recipeRows ?? []).map((r) => [r.id, r.name]));

      const [{ data: ingredientRows }, { data: itemRows }] = await Promise.all([
        recipeIds.length > 0
          ? supabase
              .from('recipe_ingredients')
              .select('id, name, recipe_id')
              .in('recipe_id', recipeIds)
              .eq('needs_translation', true)
          : Promise.resolve({ data: [] as { id: string; name: string; recipe_id: string }[] }),
        supabase
          .from('inventory_items')
          .select('id, name, category')
          .eq('property_id', propertyId)
          .eq('needs_translation', true),
      ]);

      const worklist: WorklistRow[] = [
        ...(recipeRows ?? [])
          .filter((r) => r.needs_translation)
          .map((r) => ({ id: r.id, table: 'recipes' as const, name: r.name, context: null })),
        ...(ingredientRows ?? []).map((i) => ({
          id: i.id,
          table: 'recipe_ingredients' as const,
          name: i.name,
          context: recipeNameById.get(i.recipe_id) ?? null,
        })),
        ...(itemRows ?? []).map((i) => ({
          id: i.id,
          table: 'inventory_items' as const,
          name: i.name,
          context: i.category,
        })),
      ];
      setRows(worklist);
      setLoading(false);
    })();
  }, [propertyId, supabase, role]);

  async function save(row: WorklistRow) {
    const value = (drafts[row.id] ?? '').trim();
    if (!value || savingId) return;
    setSavingId(row.id);
    const result = await resilientUpdate(supabase, row.table, { id: row.id }, { name_es: value, needs_translation: false });
    setSavingId(null);
    if (!result.ok) {
      showToast(t('failedToast'), { variant: 'error' });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSavedCount((c) => c + 1);
    showToast(t('savedToast', { item: row.name }), { variant: 'success' });
  }

  if (!canManage(role)) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-dusk text-center mt-8">{t('managersOnly')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>

      {savedCount > 0 && (
        <p className="text-xs text-sage font-medium mb-3">{t('sessionCount', { count: savedCount })}</p>
      )}

      {loading ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <p className="text-sm text-dusk text-center mt-8">{t('allDone')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.table}-${row.id}`} className="bg-card rounded-xl2 shadow-card px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg bg-mist shrink-0 flex items-center justify-center text-brass">
                  <Languages size={14} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-denim truncate">{row.name}</span>
                  {row.context && <span className="block text-xs text-dusk truncate">{row.context}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={drafts[row.id] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  placeholder={t('placeholder')}
                  className="flex-1 min-w-0 border border-cardBorder rounded-lg px-3 py-1.5 text-sm bg-mist text-denim"
                />
                <button
                  onClick={() => save(row)}
                  disabled={!drafts[row.id]?.trim() || savingId === row.id}
                  className="shrink-0 bg-denim text-white text-xs font-medium px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  {savingId === row.id ? t('saving') : t('saveButton')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
