// components/ShoppingListViewEnhanced.tsx
// Shopping list with conditional rendering: rich inventory cards OR plain text fallback
'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  fetchEnhancedShoppingList,
  fetchItemSources,
  updateShoppingItemStatus,
  removeShoppingItem,
  type ShoppingItemSource,
} from '@/lib/api/shoppingList';
import { ExternalLink, Trash2, CheckCircle2, Circle, MessageCircle, Printer, Sparkles, MoreVertical } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';

type ShoppingListItem = {
  item_id: string;
  name: string;
  category: string;
  qty_needed: number;
  unit_estimate: string | null;
  status: 'pending' | 'purchased' | 'archived';
  // Rich inventory fields (null if not linked)
  inventory_item_id: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  current_stock: number | null;
  location_name: string | null;
  supplier: string | null;
  // UI flags
  is_rich_item: boolean;
  is_staple_origin: boolean;
};

type GroupBy = 'staples-first' | 'category' | 'by-recipe';

// Present only on display rows produced by aggregateDuplicates — carries
// the real underlying row ids so toggling/deleting an aggregated row still
// acts on every real row it represents, not just the first one.
type DisplayItem = ShoppingListItem & { _mergedIds?: string[] };

export default function ShoppingListViewEnhanced({
  propertyId,
  shoppingListId,
}: {
  propertyId: string;
  shoppingListId: string;
}) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [sources, setSources] = useState<Record<string, ShoppingItemSource[]>>({});
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('staples-first');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedPills, setExpandedPills] = useState<Record<string, boolean>>({});
  const [aggregateDuplicates, setAggregateDuplicates] = useState(true);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Collapsible sections -- same pattern as the Recipes grid's letter
  // headers (title + count + chevron), applied to whichever grouping is
  // active (Staples/Recipe Ingredients, aisle categories, or recipes)
  // rather than forcing a literal A-Z regrouping on top of those.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Same broken-link concern as InventoryClient — photo_url existing isn't
  // the same as the image actually loading.
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  // Guards against overlapping toggle requests when a checkbox is tapped
  // again before the previous request for the same item(s) has resolved.
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const showToast = useToast();
  const locale = useLocale();
  const t = useTranslations('shopping');
  const supabase = createClient();

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchEnhancedShoppingList(shoppingListId);
      setItems(data);

      const sourceRows = await fetchItemSources(shoppingListId);
      const byItem: Record<string, ShoppingItemSource[]> = {};
      for (const row of sourceRows) {
        (byItem[row.shopping_list_item_id] ??= []).push(row);
      }
      setSources(byItem);
    } catch (error) {
      console.error('Error loading shopping list:', error);
      showToast('Failed to load shopping list.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [shoppingListId]);

  const toggleStatus = async (itemId: string, currentStatus: string) => {
    const newStatus = (currentStatus === 'purchased' ? 'pending' : 'purchased') as 'pending' | 'purchased';
    try {
      await updateShoppingItemStatus(itemId, newStatus);
      setItems(prev =>
        prev.map(item => (item.item_id === itemId ? { ...item, status: newStatus } : item))
      );
    } catch (error) {
      console.error('Error updating item:', error);
      showToast('Failed to update item.', { variant: 'error' });
    }
  };

  // Aggregated display rows carry _mergedIds — these two wrap the real
  // single-id actions above so toggling/deleting a merged row still acts
  // on every real underlying row, not just the display row's own id.
  const isItemProcessing = (item: DisplayItem) => {
    const ids = item._mergedIds ?? [item.item_id];
    return ids.some((id) => processingIds.has(id));
  };

  const toggleStatusForDisplayItem = async (item: DisplayItem) => {
    const ids = item._mergedIds ?? [item.item_id];
    if (ids.some((id) => processingIds.has(id))) return;
    setProcessingIds((prev) => new Set([...prev, ...ids]));
    try {
      if (ids.length === 1) {
        await toggleStatus(item.item_id, item.status);
        return;
      }
      const newStatus = item.status === 'purchased' ? 'pending' : 'purchased';
      try {
        await Promise.all(ids.map((id) => updateShoppingItemStatus(id, newStatus)));
        setItems((prev) => prev.map((i) => (ids.includes(i.item_id) ? { ...i, status: newStatus } : i)));
      } catch (error) {
        console.error('Error updating merged item:', error);
        showToast('Failed to update item.', { variant: 'error' });
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const deleteDisplayItem = async (item: DisplayItem) => {
    const ids = item._mergedIds ?? [item.item_id];
    if (ids.length === 1) {
      await deleteItem(item.item_id);
      return;
    }
    try {
      await Promise.all(ids.map((id) => removeShoppingItem(id)));
      setItems((prev) => prev.filter((i) => !ids.includes(i.item_id)));
      showToast('Items removed.', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting merged item:', error);
      showToast('Failed to delete item.', { variant: 'error' });
    }
  };

  async function clearChecked() {
    const ids = items.filter((i) => i.status === 'purchased').map((i) => i.item_id);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => removeShoppingItem(id)));
      setItems((prev) => prev.filter((i) => i.status !== 'purchased'));
      showToast(`Cleared ${ids.length} checked item${ids.length === 1 ? '' : 's'}.`, { variant: 'success' });
    } catch (error) {
      console.error('Error clearing checked items:', error);
      showToast('Failed to clear checked items.', { variant: 'error' });
    }
  }

  function aggregateItems(rawItems: ShoppingListItem[]): DisplayItem[] {
    if (!aggregateDuplicates) return rawItems;
    const map = new Map<string, DisplayItem>();
    for (const item of rawItems) {
      const key = item.name.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.qty_needed = (existing.qty_needed || 0) + (item.qty_needed || 0);
        existing._mergedIds = [...(existing._mergedIds ?? [existing.item_id]), item.item_id];
      } else {
        map.set(key, { ...item });
      }
    }
    return [...map.values()];
  }

  const deleteItem = async (itemId: string) => {
    try {
      await removeShoppingItem(itemId);
      setItems(prev => prev.filter(item => item.item_id !== itemId));
      showToast('Item removed.', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('Failed to delete item.', { variant: 'error' });
    }
  };

  // Same "current week" logic as the meal-plan page's generator — this just
  // surfaces the existing, already-working action from the empty state so
  // it doesn't read as a dead end. Not a new auto-generation feature.
  async function handleGenerateFromWeek() {
    setGenerating(true);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: entries } = await supabase
      .from('meal_plan_entries')
      .select('recipe_id')
      .eq('property_id', propertyId)
      .gte('plan_date', fmt(start))
      .lte('plan_date', fmt(end));

    const recipeIds = (entries ?? []).map((e) => e.recipe_id).filter((id): id is string => !!id);
    if (recipeIds.length === 0) {
      setGenerating(false);
      showToast(t('noLinkedRecipesThisWeek'));
      return;
    }

    const { data: ingredients } = await supabase
      .from('recipe_ingredients')
      .select('name, quantity, unit, category, recipe_id')
      .in('recipe_id', recipeIds);

    if (!ingredients || ingredients.length === 0) {
      setGenerating(false);
      showToast(t('noLinkedRecipesThisWeek'));
      return;
    }

    const result = await addIngredientsToShoppingList(supabase, propertyId, ingredients);
    setGenerating(false);
    if (!result.ok) {
      showToast(result.error, { variant: 'error' });
      return;
    }
    showToast(t('generatedCount', { count: result.count }), { variant: 'success' });
    loadItems();
  }

  function toggleGroup(title: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function sourceTitle(s: ShoppingItemSource) {
    return locale === 'es' && s.recipe_name_es ? s.recipe_name_es : s.recipe_name;
  }

  function recipePills(itemId: string) {
    const itemSources = sources[itemId];
    if (!itemSources || itemSources.length === 0) return null;
    const [first, ...rest] = itemSources;
    return (
      <div className="relative flex items-center gap-1 mt-1">
        <span className="rounded-full bg-gold-light/20 px-2 py-0.5 text-[10px] text-charcoal">
          {sourceTitle(first)}
        </span>
        {rest.length > 0 && (
          <button
            onClick={() => setExpandedPills((e) => ({ ...e, [itemId]: !e[itemId] }))}
            className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold-dark"
          >
            +{rest.length} more
          </button>
        )}
        {expandedPills[itemId] && rest.length > 0 && (
          <div className="absolute left-0 top-6 z-10 w-56 rounded-lg border border-gold-light/40 bg-white p-2 shadow-lg">
            {itemSources.map((s) => (
              <div key={s.recipe_id} className="flex justify-between py-0.5 text-xs">
                <span>{sourceTitle(s)}</span>
                <span className="text-charcoal/50">
                  {s.quantity ?? ''} {s.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function shareWhatsApp() {
    const weekOf = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    let text = `*Shopping List – Week of ${weekOf}*\n`;
    for (const group of groupItems()) {
      if (group.items.length === 0) continue;
      text += `\n*${group.title}:*\n`;
      for (const item of group.items) {
        text += `- ${item.name}\n`;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  const groupItems = () => {
    // Purchased items get pulled into their own "Completed" section below,
    // regardless of view — an active shopping list shouldn't need scrolling
    // past everything already in the cart to see what's left.
    const rawActiveItems = items.filter((i) => i.status !== 'purchased');
    // Aggregating collapses same-name rows from different recipes into one
    // display row, which would make "By Recipe" grouping lose its meaning
    // (a merged row can't cleanly belong to a single recipe group) — so
    // aggregation only applies outside that view.
    const activeItems: DisplayItem[] = groupBy === 'by-recipe' ? rawActiveItems : aggregateItems(rawActiveItems);

    if (groupBy === 'staples-first') {
      const staples = activeItems.filter(i => i.is_staple_origin);
      const recipes = activeItems.filter(i => !i.is_staple_origin);
      return [
        { title: 'Staples', items: staples },
        { title: 'Recipe Ingredients', items: recipes }
      ];
    }
    if (groupBy === 'by-recipe') {
      const groupsMap: Record<string, { title: string; items: DisplayItem[] }> = {};
      for (const item of activeItems) {
        const itemSources = sources[item.item_id];
        const primary = itemSources?.[0];
        const key = primary?.recipe_id ?? 'unassigned';
        const title = primary ? sourceTitle(primary) : 'Other';
        (groupsMap[key] ??= { title, items: [] }).items.push(item);
      }
      // "Other" (items with no recipe attribution — old items from before
      // this feature existed, or hand-added ones) is pushed to the end
      // rather than wherever it happened to be encountered first, so a big
      // leftover bucket doesn't bury the groups that actually answer "what
      // recipe is this for."
      return Object.values(groupsMap).sort((a, b) => {
        if (a.title === 'Other') return 1;
        if (b.title === 'Other') return -1;
        return a.title.localeCompare(b.title);
      });
    }
    const byCategory = activeItems.reduce(
      (acc, item) => {
        const cat = item.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      },
      {} as Record<string, DisplayItem[]>
    );
    return Object.entries(byCategory)
      .map(([title, items]) => ({ title, items }))
      .sort((a, b) => {
        if (a.title === 'Other') return 1;
        if (b.title === 'Other') return -1;
        return a.title.localeCompare(b.title);
      });
  };

  function renderItemCard(item: DisplayItem) {
    const mergedCount = item._mergedIds?.length ?? 1;
    return (
      <div
        key={item.item_id}
        className={`rounded-lg border bg-white border-gold-light/20 hover:border-gold-light/40 transition-colors ${
          density === 'compact' ? 'p-2' : 'p-3'
        }`}
      >
        {/* RICH ITEM: Full inventory card with photo, location, reorder link */}
        {item.is_rich_item ? (
          <div className="flex gap-3">
            {/* Photo */}
            {item.photo_url && !brokenPhotoIds.has(item.item_id) ? (
              <div className="flex-shrink-0">
                <img
                  src={item.photo_url}
                  alt={item.name}
                  className="h-16 w-16 rounded object-cover bg-gold-light/10"
                  onError={() => setBrokenPhotoIds((prev) => new Set(prev).add(item.item_id))}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 h-16 w-16 rounded bg-gold-light/10 flex items-center justify-center text-xs text-charcoal/40">
                No photo
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Name + Status */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <h4
                    className={`font-medium text-sm ${
                      item.status === 'purchased' ? 'line-through text-charcoal/50' : 'text-charcoal'
                    }`}
                  >
                    {item.name}
                    {mergedCount > 1 && <span className="text-charcoal/40 font-normal"> ×{mergedCount}</span>}
                  </h4>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    {item.supplier && <span>{item.supplier} · </span>}
                    {item.category}
                  </p>
                  {mergedCount === 1 && recipePills(item.item_id)}
                </div>
                <button
                  onClick={() => toggleStatusForDisplayItem(item)}
                  disabled={isItemProcessing(item)}
                  className={`print:hidden flex-shrink-0 text-charcoal hover:text-sage transition-colors ${isItemProcessing(item) ? 'opacity-40 cursor-wait' : ''}`}
                >
                  {item.status === 'purchased' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Stock + Location */}
              <div className="flex items-center gap-2 mb-2 text-xs text-charcoal/60">
                {item.current_stock !== null && (
                  <span className="bg-gold-light/20 px-2 py-0.5 rounded-full">
                    In stock: {item.current_stock}
                  </span>
                )}
                {item.location_name && (
                  <span className="bg-gold-light/20 px-2 py-0.5 rounded-full text-charcoal/70">
                    📍 {item.location_name}
                  </span>
                )}
              </div>

              {/* Reorder Link + Delete */}
              <div className="print:hidden flex items-center gap-2">
                {item.reorder_link ? (
                  <a
                    href={item.reorder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gold-dark hover:text-charcoal transition-colors font-medium"
                  >
                    Reorder <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-charcoal/30">No reorder link</span>
                )}
                <button
                  onClick={() => deleteDisplayItem(item)}
                  className="ml-auto text-charcoal/40 hover:text-rust transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* PLAIN TEXT FALLBACK: For unmapped ingredients */
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4
                className={`font-medium text-sm ${
                  item.status === 'purchased' ? 'line-through text-charcoal/50' : 'text-charcoal'
                }`}
              >
                {item.name}
                {mergedCount > 1 && <span className="text-charcoal/40 font-normal"> ×{mergedCount}</span>}
              </h4>
              <p className="text-xs text-charcoal/60 mt-0.5">{item.category}</p>
              {mergedCount === 1 && recipePills(item.item_id)}
            </div>

            <div className="print:hidden flex items-center gap-2">
              <button
                onClick={() => toggleStatusForDisplayItem(item)}
                disabled={isItemProcessing(item)}
                className={`text-charcoal hover:text-sage transition-colors ${isItemProcessing(item) ? 'opacity-40 cursor-wait' : ''}`}
              >
                {item.status === 'purchased' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => deleteDisplayItem(item)}
                className="text-charcoal/40 hover:text-rust transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-charcoal/50">Loading shopping list...</div>;
  }

  const groups = groupItems();
  const completedItems = items.filter((i) => i.status === 'purchased');

  return (
    <div className="space-y-4">
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>

      {/* More options */}
      <div className="print:hidden relative flex items-center justify-end">
        <button
          onClick={() => setShowMoreMenu((v) => !v)}
          aria-label="More options"
          title="More options"
          className="text-charcoal/60 hover:text-charcoal p-1"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMoreMenu && (
          <div
            className="absolute right-0 top-8 z-20 w-64 rounded-2xl border border-gold-light/40 bg-white shadow-lg p-3 space-y-3"
            onMouseLeave={() => setShowMoreMenu(false)}
          >
            <label className="flex items-center justify-between text-sm text-charcoal">
              <span>Aggregate duplicates</span>
              <input
                type="checkbox"
                checked={aggregateDuplicates}
                onChange={(e) => setAggregateDuplicates(e.target.checked)}
                className="h-4 w-4 accent-gold-dark rounded"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-charcoal">
              <span>Hide checked items</span>
              <input
                type="checkbox"
                checked={!showCompleted}
                onChange={(e) => setShowCompleted(!e.target.checked)}
                className="h-4 w-4 accent-gold-dark rounded"
              />
            </label>
            <button
              onClick={() => {
                clearChecked();
                setShowMoreMenu(false);
              }}
              disabled={completedItems.length === 0}
              className="w-full text-left text-sm text-rust disabled:opacity-40"
            >
              Clear checked ({completedItems.length})
            </button>
            <div className="border-t border-gold-light/30 pt-3">
              <p className="text-xs text-charcoal/40 mb-1.5">Density</p>
              <div className="inline-flex rounded-full border border-gold-light/60 p-0.5 text-xs">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`rounded-full px-3 py-1 capitalize ${
                      density === d ? 'bg-gold-dark text-white' : 'text-charcoal/60'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-gold-light/30 pt-3 flex items-center gap-4">
              <button
                onClick={() => {
                  shareWhatsApp();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-1.5 text-sm text-charcoal/70 hover:text-charcoal"
              >
                <MessageCircle className="h-4 w-4" /> Share
              </button>
              <button
                onClick={() => {
                  window.print();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-1.5 text-sm text-charcoal/70 hover:text-charcoal"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Options */}
      <div className="print:hidden flex gap-2 flex-wrap">
        {(['staples-first', 'category', 'by-recipe'] as const).map(option => (
          <button
            key={option}
            onClick={() => setGroupBy(option)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              groupBy === option
                ? 'bg-charcoal text-cream'
                : 'bg-gold-light/20 text-charcoal hover:bg-gold-light/30'
            }`}
          >
            {option === 'staples-first' ? 'Staples First' : option === 'category' ? 'By Aisle' : 'By Recipe'}
          </button>
        ))}
      </div>

      {/* Items Grouped */}
      {groups.map(group => {
        if (group.items.length === 0) return null;
        const collapsed = collapsedGroups.has(group.title);
        return (
          <div key={group.title} className="space-y-2">
            <button
              onClick={() => toggleGroup(group.title)}
              className="w-full flex items-center justify-between text-sm font-semibold text-charcoal bg-gold-light/20 px-3 py-2 rounded-lg"
            >
              <span>
                {group.title} ({group.items.length})
              </span>
              <span className="text-xs text-charcoal/40">{collapsed ? '▸' : '▾'}</span>
            </button>
            {!collapsed && group.items.map(renderItemCard)}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-12 px-4">
          <p className="text-sm text-charcoal/60 mb-1">{t('emptyTitle')}</p>
          <p className="text-xs text-charcoal/40 mb-4">{t('emptySubtitle')}</p>
          <button
            onClick={handleGenerateFromWeek}
            disabled={generating}
            className="inline-flex items-center gap-1.5 bg-gold-dark text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? t('generating') : t('generateFromWeek')}
          </button>
        </div>
      )}

      {completedItems.length > 0 && (
        <div className="print:hidden space-y-2 pt-2">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-charcoal/60 bg-cream px-3 py-2 rounded-lg"
          >
            <span>Completed ({completedItems.length})</span>
            <span className="text-xs">{showCompleted ? '▾' : '▸'}</span>
          </button>
          {showCompleted && <div className="space-y-2 opacity-60">{completedItems.map(renderItemCard)}</div>}
        </div>
      )}

      <div className="text-xs text-charcoal/40 pt-2 border-t border-gold-light/20">
        {items.length} items total
      </div>
    </div>
  );
}
