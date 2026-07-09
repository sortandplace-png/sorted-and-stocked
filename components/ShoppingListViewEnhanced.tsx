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
import { ExternalLink, Trash2, CheckCircle2, Circle, MessageCircle, Printer, Sparkles } from 'lucide-react';
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
  // Same broken-link concern as InventoryClient — photo_url existing isn't
  // the same as the image actually loading.
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
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
    const activeItems = items.filter((i) => i.status !== 'purchased');

    if (groupBy === 'staples-first') {
      const staples = activeItems.filter(i => i.is_staple_origin);
      const recipes = activeItems.filter(i => !i.is_staple_origin);
      return [
        { title: 'Staples', items: staples },
        { title: 'Recipe Ingredients', items: recipes }
      ];
    }
    if (groupBy === 'by-recipe') {
      const groupsMap: Record<string, { title: string; items: ShoppingListItem[] }> = {};
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
      {} as Record<string, ShoppingListItem[]>
    );
    return Object.entries(byCategory)
      .map(([title, items]) => ({ title, items }))
      .sort((a, b) => {
        if (a.title === 'Other') return 1;
        if (b.title === 'Other') return -1;
        return a.title.localeCompare(b.title);
      });
  };

  function renderItemCard(item: ShoppingListItem) {
    return (
      <div
        key={item.item_id}
        className="p-3 rounded-lg border bg-white border-gold-light/20 hover:border-gold-light/40 transition-colors"
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
                  </h4>
                  <p className="text-xs text-charcoal/60 mt-0.5">
                    {item.supplier && <span>{item.supplier} · </span>}
                    {item.category}
                  </p>
                  {recipePills(item.item_id)}
                </div>
                <button
                  onClick={() => toggleStatus(item.item_id, item.status)}
                  className="print:hidden flex-shrink-0 text-charcoal hover:text-sage transition-colors"
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
                  onClick={() => deleteItem(item.item_id)}
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
              </h4>
              <p className="text-xs text-charcoal/60 mt-0.5">{item.category}</p>
              {recipePills(item.item_id)}
            </div>

            <div className="print:hidden flex items-center gap-2">
              <button
                onClick={() => toggleStatus(item.item_id, item.status)}
                className="text-charcoal hover:text-sage transition-colors"
              >
                {item.status === 'purchased' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => deleteItem(item.item_id)}
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

      {/* Share / Print */}
      <div className="print:hidden flex items-center justify-end gap-3 text-charcoal/60">
        <button onClick={shareWhatsApp} aria-label="Share on WhatsApp" title="Share on WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </button>
        <button onClick={() => window.print()} aria-label="Print" title="Print">
          <Printer className="h-4 w-4" />
        </button>
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
      {groups.map(
        group =>
          group.items.length > 0 && (
            <div key={group.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-charcoal bg-gold-light/20 px-3 py-2 rounded-lg">
                {group.title} ({group.items.length})
              </h3>
              {group.items.map(renderItemCard)}
            </div>
          )
      )}

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
