// components/ShoppingListClient.tsx
// Data-fetching parent; ShoppingListViewEnhanced is the real (only) render
// path -- ShoppingListView.tsx was the original presentational component
// this fetched for, since removed as dead code once ShoppingListViewEnhanced
// replaced it. ShoppingListItem lives here now instead of over there, since
// this is its only consumer.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate } from '@/lib/resilient-write';
import { Lightbulb } from 'lucide-react';
import ShoppingListViewEnhanced from '@/components/ShoppingListViewEnhanced';
import StaplesTab from '@/components/StaplesTab';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import Pin from '@/components/PinAccent';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import BackLink from '@/components/ui/BackLink';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import { Settings2 } from 'lucide-react';

export type ShoppingListItem = {
  id: string;
  name: string;
  category: string | null;
  qty_needed: number;
  status: 'pending' | 'purchased';
};

type PairingRule = { id: string; item_a: string; item_b: string };

export default function ShoppingListClient({ propertyId }: { propertyId: string }) {
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);
  // SS-278: the tab lives in the URL, not in component state. It was state
  // only, so a refresh dropped you back on Recipe Ingredients no matter which
  // tab you were reading -- and a service-worker reload did the same. In the
  // URL it also survives the back button and makes the tab linkable.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab: 'recipes' | 'staples' = searchParams.get('tab') === 'staples' ? 'staples' : 'recipes';

  const setActiveTab = useCallback(
    (tab: 'recipes' | 'staples') => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('tab', tab);
      // replace, not push -- switching tabs should not stack history entries
      // that the back button then has to walk through one at a time.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );
  const [pairingRules, setPairingRules] = useState<PairingRule[]>([]);
  const [dismissedPairingNudge, setDismissedPairingNudge] = useState(false);
  const [pesachModeEnabled, setPesachModeEnabled] = useState(false);
  const [autoRestockEnabled, setAutoRestockEnabled] = useState(false);
  const [savingAutoRestock, setSavingAutoRestock] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('shopping');
  const role = usePropertyRole();

  // Same feature_flags.pesach_mode toggled on the Inventory page -- when
  // on, ShoppingListViewEnhanced flags (not silently includes) items
  // sourced from a Pesach recipe that aren't cleared yet. auto_restock read
  // in the same round trip -- it used to live on its own Shopping Rules
  // page (components/ShoppingRulesClient.tsx, since removed); folded in
  // here per SS-375/SS-271 (a whole page for one boolean was the pattern
  // being removed). Confirmed live-consumed before folding it: it's read by
  // the handle_low_stock() trigger (trg_inventory_low_stock on
  // inventory_items) that auto-adds a dropped-below-minimum item to the
  // active shopping list -- a real, working switch, just never turned on
  // for any property yet, which is why it read as unfamiliar.
  useEffect(() => {
    supabase
      .from('properties')
      .select('feature_flags')
      .eq('id', propertyId)
      .single()
      .then(({ data }) => {
        const flags = (data?.feature_flags ?? {}) as Record<string, boolean>;
        setPesachModeEnabled(!!flags.pesach_mode);
        setAutoRestockEnabled(!!flags.auto_restock);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function toggleAutoRestock() {
    setSavingAutoRestock(true);
    const next = !autoRestockEnabled;
    // Read-then-merge -- feature_flags is a single jsonb column shared by
    // every flag on this property (pesach_mode, guest_taste_memory, etc.),
    // never blind-overwrite.
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (current?.feature_flags ?? {}) as Record<string, boolean>;
    const { error: flagError } = await supabase
      .from('properties')
      .update({ feature_flags: { ...flags, auto_restock: next } })
      .eq('id', propertyId);
    setSavingAutoRestock(false);
    if (flagError) {
      showToast('Failed to update auto-restock setting.', { variant: 'error' });
      return;
    }
    setAutoRestockEnabled(next);
    showToast(next ? 'Auto-restock enabled.' : 'Auto-restock disabled.', { variant: 'success' });
  }

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

  // Supplying the id ourselves means the optimistic local row and the real
  // server row share one id from the start, so a later toggle/update by id
  // always finds the right row instead of the stale local-only one. Shared
  // by the typed "add item" bar and the "Add X" button on a pairing nudge —
  // same insert, two entry points.
  async function addItemByName(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed || !listId) return false;

    const newId = crypto.randomUUID();
    const payload = {
      id: newId,
      shopping_list_id: listId,
      name: trimmed,
      category: null,
      qty_needed: 1,
      status: 'pending' as const,
    };

    setItems((prev) => [...prev, payload]);

    const result = await resilientInsert(supabase, 'shopping_list_items', payload);
    if (!result.ok) {
      setError(result.error);
      showToast(t('failedToAdd'), { variant: 'error' });
      setItems((prev) => prev.filter((i) => i.id !== newId));
      return false;
    }
    return true;
  }

  async function addCustomItem() {
    if (!newItemName.trim()) return;
    setAdding(true);
    const name = newItemName;
    setNewItemName('');
    await addItemByName(name);
    setAdding(false);
  }

  async function addSuggestedItem(name: string) {
    const ok = await addItemByName(name);
    if (ok) showToast(`Added ${name} to your list.`, { variant: 'success' });
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="pt-4">
      {/* Above the tab bar rather than below it: the tab bar is sticky, so a
          link placed inside it would ride down the page as you scroll, and
          one placed under it would scroll away beneath a sticky element.
          Padded to the same 6xl gutter the tabs use so it lines up with the
          content edge rather than the viewport edge. */}
      <div className="max-w-6xl mx-auto px-4">
        <BackLink fallbackHref={`/properties/${propertyId}/dashboard`} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-cardBorder sticky top-0 z-10 mb-4">
        <div className="max-w-6xl mx-auto flex px-4">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'recipes'
                ? 'border-denim text-denim'
                : 'border-transparent text-dusk hover:text-denim'
            }`}
          >
            {t('recipeIngredientsTab')}
          </button>
          <button
            onClick={() => setActiveTab('staples')}
            className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'staples'
                ? 'border-denim text-denim'
                : 'border-transparent text-dusk hover:text-denim'
            }`}
          >
            {t('householdStaplesTab')}
          </button>
        </div>
      </div>

      {/* Auto-restock: folded in from its own standalone Shopping Rules page
          (SS-375/SS-271 -- a whole page for one boolean was the pattern
          being removed). Owner/manager only, matching that page's own gate
          -- this is a property-level rule, not something staff should be
          changing. Collapsed by default so it doesn't compete with the
          list itself for attention on every visit. */}
      {canManage(role) && (
        <div className="max-w-6xl mx-auto px-4 mb-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-dusk hover:text-denim transition-colors"
          >
            <Settings2 size={13} strokeWidth={2.25} aria-hidden="true" />
            {t('settingsToggle')}
          </button>
          {showSettings && (
            <div className="mt-2 bg-card rounded-xl2 border border-cardBorder shadow-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-denim">{t('autoRestockLabel')}</p>
                <p className="text-xs text-dusk">{t('autoRestockDescription')}</p>
              </div>
              <button
                onClick={toggleAutoRestock}
                disabled={savingAutoRestock}
                role="switch"
                aria-checked={autoRestockEnabled}
                aria-label={t('autoRestockLabel')}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                  autoRestockEnabled ? 'bg-denim' : 'bg-mist border border-cardBorder'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    autoRestockEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      )}

      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center text-xs text-dusk overflow-hidden transition-all"
          style={{ height: refreshing ? 32 : pullDistance }}
        >
          {refreshing ? t('refreshing') : pullDistance > 50 ? t('releaseToRefresh') : t('pullToRefresh')}
        </div>
      )}
      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-lg px-3 py-2 mb-3 mx-4 max-w-6xl md:mx-auto">
          {error}
        </p>
      )}

      {!dismissedPairingNudge && missingPairs.length > 0 && (
        <div className="relative mx-4 max-w-6xl md:mx-auto mb-3 bg-card rounded-xl2 border border-cardBorder shadow-card p-4 flex items-start gap-2.5">
          <Pin size="sm" />
          <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-brass/15 flex items-center justify-center">
            <Lightbulb className="h-3.5 w-3.5 text-brass" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-[10px] tracking-[0.18em] uppercase font-semibold text-brass">Pairs well with your stock</p>
            {missingPairs.map((p) => (
              <div key={p.missing} className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-denim">
                  You have <span className="font-medium">{p.have}</span> in stock but no{' '}
                  <span className="font-medium">{p.missing}</span> on your list — commonly paired, want to add it?
                </p>
                <button
                  onClick={() => addSuggestedItem(p.missing)}
                  className="shrink-0 text-xs font-medium text-white bg-denim px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
                >
                  Add {p.missing}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setDismissedPairingNudge(true)}
            className="text-dusk hover:text-denim text-xs shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recipe Ingredients Tab */}
      {activeTab === 'recipes' && (
        <>
          <div className="max-w-6xl mx-auto px-4 mb-4 flex gap-2">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
              placeholder={t('addItemPlaceholder')}
              className="flex-1 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2 bg-mist text-sm text-denim"
            />
            <button
              onClick={addCustomItem}
              disabled={adding || !newItemName.trim()}
              className="px-5 rounded-full bg-denim text-white text-sm disabled:opacity-40 font-medium"
            >
              {t('addItemButton')}
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-4">
            {listId ? (
              <ShoppingListViewEnhanced propertyId={propertyId} shoppingListId={listId} pesachModeEnabled={pesachModeEnabled} />
            ) : (
              <p className="text-sm text-dusk text-center mt-8">{t('loadingList')}</p>
            )}
          </div>
        </>
      )}

      {/* Household Staples Tab.
          This wrapper was a bare max-w-md, so the earlier width pass -- which
          replaced the string "max-w-md lg:max-w-6xl" -- did not match it, and
          the whole tab stayed pinned to 448px. Collapsed it looked survivable;
          expanded it clipped product names mid-word. */}
      {activeTab === 'staples' && (
        <div className="max-w-6xl mx-auto px-4">
          {listId ? (
            <StaplesTab propertyId={propertyId} shoppingListId={listId} />
          ) : (
            <p className="text-sm text-dusk text-center mt-8">{t('loadingStaples')}</p>
          )}
        </div>
      )}
    </div>
  );
}
