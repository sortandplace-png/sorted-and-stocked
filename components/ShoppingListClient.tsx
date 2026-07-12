// components/ShoppingListClient.tsx
// This is the data-fetching parent ShoppingListView was waiting for.
// The view component itself never changes — it stays presentational.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate } from '@/lib/resilient-write';
import ShoppingListView, { ShoppingListItem } from '@/components/ShoppingListView';
import ShoppingListViewEnhanced from '@/components/ShoppingListViewEnhanced';
import StaplesTab from '@/components/StaplesTab';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';

type PairingRule = { id: string; item_a: string; item_b: string };

export default function ShoppingListClient({ propertyId }: { propertyId: string }) {
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipes' | 'staples'>('recipes');
  const [pairingRules, setPairingRules] = useState<PairingRule[]>([]);
  const [dismissedPairingNudge, setDismissedPairingNudge] = useState(false);

  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('shopping');

  // Reference table, not property-scoped -- fetched once, same pattern as
  // other curated reference data elsewhere in this app.
  useEffect(() => {
    supabase
      .from('pairing_rules')
      .select('id, item_a, item_b')
      .then(({ data }) => setPairingRules(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Forgot Something" (3e-ii): one-sided real pairs still on the active
  // list, checked by case-insensitive substring against pending items only
  // -- an already-purchased item doesn't need a reminder.
  const pendingNames = items.filter((i) => i.status === 'pending').map((i) => i.name.toLowerCase());
  const missingPairs = pairingRules
    .map((rule) => {
      const hasA = pendingNames.some((n) => n.includes(rule.item_a.toLowerCase()));
      const hasB = pendingNames.some((n) => n.includes(rule.item_b.toLowerCase()));
      if (hasA && !hasB) return { have: rule.item_a, missing: rule.item_b };
      if (hasB && !hasA) return { have: rule.item_b, missing: rule.item_a };
      return null;
    })
    .filter((p): p is { have: string; missing: string } => p !== null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // The low-stock trigger (see 001_init_schema.sql) auto-creates an
    // active list when needed, but a brand-new property won't have one
    // yet — create it lazily here rather than showing a dead end.
    let { data: list } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!list) {
      const { data: created, error: createError } = await supabase
        .from('shopping_lists')
        .insert({ property_id: propertyId, name: 'Shopping List', status: 'active' })
        .select('id')
        .single();

      if (createError?.code === '23505') {
        // Another near-simultaneous load already created the active list
        // (double-render, a second tab, a slow-network retry) — the unique
        // index on (property_id) where status='active' caught it. That's
        // not a real failure, just fetch the list that won the race.
        const { data: existing } = await supabase
          .from('shopping_lists')
          .select('id')
          .eq('property_id', propertyId)
          .eq('status', 'active')
          .single();
        list = existing;
      } else if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      } else {
        list = created;
      }
    }

    if (!list) {
      setError('Failed to load or create the shopping list.');
      setLoading(false);
      return;
    }

    setListId(list.id);

    const { data: listItems, error: itemsError } = await supabase
      .from('shopping_list_items')
      .select('id, name, category, qty_needed, status')
      .eq('shopping_list_id', list.id)
      .order('created_at');

    if (itemsError) setError(itemsError.message);
    setItems(listItems ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { pullDistance, refreshing } = usePullToRefresh(loadData);

  async function handleToggle(itemId: string, nextStatus: 'pending' | 'purchased') {
    // Optimistic — the person is standing in a store aisle with bad
    // signal; the checkbox must respond instantly regardless of network.
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: nextStatus } : i)));
    const result = await resilientUpdate(
      supabase,
      'shopping_list_items',
      { id: itemId },
      { status: nextStatus }
    );
    if (!result.ok) {
      setError(result.error);
      showToast(t('revertedToast'), { variant: 'error' });
      // Roll back the optimistic flip since this was a real failure, not
      // just "offline" (offline is already handled inside resilientUpdate).
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, status: nextStatus === 'purchased' ? 'pending' : 'purchased' } : i
        )
      );
    } else if (result.queued) {
      showToast(t('queuedToast'));
    }
  }

  async function addCustomItem() {
    const name = newItemName.trim();
    if (!name || !listId) return;
    setAdding(true);

    // Supplying the id ourselves means the optimistic local row and the
    // real server row share one id from the start, so a later toggle/update
    // by id always finds the right row instead of the stale local-only one.
    const newId = crypto.randomUUID();
    const payload = {
      id: newId,
      shopping_list_id: listId,
      name,
      category: null,
      qty_needed: 1,
      status: 'pending' as const,
    };

    setItems((prev) => [...prev, payload]);
    setNewItemName('');

    const result = await resilientInsert(supabase, 'shopping_list_items', payload);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      showToast(t('failedToAdd'), { variant: 'error' });
      setItems((prev) => prev.filter((i) => i.id !== newId));
    }
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="pt-4">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gold-light/20 sticky top-0 z-10 mb-4">
        <div className="max-w-md mx-auto flex px-4">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'recipes'
                ? 'border-charcoal text-charcoal'
                : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            {t('recipeIngredientsTab')}
          </button>
          <button
            onClick={() => setActiveTab('staples')}
            className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'staples'
                ? 'border-charcoal text-charcoal'
                : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            {t('householdStaplesTab')}
          </button>
        </div>
      </div>

      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center text-xs text-charcoal/40 overflow-hidden transition-all"
          style={{ height: refreshing ? 32 : pullDistance }}
        >
          {refreshing ? t('refreshing') : pullDistance > 50 ? t('releaseToRefresh') : t('pullToRefresh')}
        </div>
      )}
      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-lg px-3 py-2 mb-3 mx-4 max-w-md md:mx-auto">
          {error}
        </p>
      )}

      {!dismissedPairingNudge && missingPairs.length > 0 && (
        <div className="mx-4 max-w-md md:mx-auto mb-3 bg-gold-light/20 border border-gold-light rounded-2xl p-3 flex items-start justify-between gap-2">
          <p className="text-sm text-charcoal">
            {missingPairs.map((p, i) => (
              <span key={p.missing}>
                {i > 0 && ' · '}
                Forgot <span className="font-medium">{p.missing}</span>? You have {p.have}.
              </span>
            ))}
          </p>
          <button
            onClick={() => setDismissedPairingNudge(true)}
            className="text-charcoal/40 hover:text-charcoal text-xs shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recipe Ingredients Tab */}
      {activeTab === 'recipes' && (
        <>
          <div className="max-w-md mx-auto px-4 mb-4 flex gap-2">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
              placeholder={t('addItemPlaceholder')}
              className="flex-1 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-white text-sm"
            />
            <button
              onClick={addCustomItem}
              disabled={adding || !newItemName.trim()}
              className="px-5 rounded-full bg-charcoal text-cream text-sm disabled:opacity-40 font-medium"
            >
              {t('addItemButton')}
            </button>
          </div>

          <div className="max-w-md mx-auto px-4">
            {listId ? (
              <ShoppingListViewEnhanced propertyId={propertyId} shoppingListId={listId} />
            ) : (
              <p className="text-sm text-charcoal/40 text-center mt-8">{t('loadingList')}</p>
            )}
          </div>
        </>
      )}

      {/* Household Staples Tab */}
      {activeTab === 'staples' && (
        <div className="max-w-md mx-auto px-4">
          {listId ? (
            <StaplesTab propertyId={propertyId} shoppingListId={listId} />
          ) : (
            <p className="text-sm text-charcoal/40 text-center mt-8">{t('loadingStaples')}</p>
          )}
        </div>
      )}
    </div>
  );
}
