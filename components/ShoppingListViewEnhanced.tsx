// components/ShoppingListViewEnhanced.tsx
// Shopping list with conditional rendering: rich inventory cards OR plain text fallback
'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  fetchEnhancedShoppingList,
  fetchItemSources,
  updateShoppingItemStatus,
  removeShoppingItem,
  type ShoppingItemSource,
} from '@/lib/api/shoppingList';
import { ExternalLink, Trash2, CheckCircle2, Circle, MessageCircle, Printer } from 'lucide-react';
import { useToast } from '@/components/Toast';

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

export default function ShoppingListViewEnhanced({ shoppingListId }: { shoppingListId: string }) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [sources, setSources] = useState<Record<string, ShoppingItemSource[]>>({});
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('staples-first');
  const [expandedPills, setExpandedPills] = useState<Record<string, boolean>>({});
  // Same broken-link concern as InventoryClient — photo_url existing isn't
  // the same as the image actually loading.
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());
  const showToast = useToast();
  const locale = useLocale();

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

  function sourceTitle(s: ShoppingItemSource) {
    return locale === 'es' && s.recipe_name_es ? s.recipe_name_es : s.recipe_name;
  }

  function recipePills(itemId: string) {
    const itemSources = sources[itemId];
    if (!itemSources || itemSources.length === 0) return null;
    const [first, ...rest] = itemSources;
    return (
      <div className="relative flex items-center gap-1 mt-1">
        <span className="rounded-full bg-gold-light/20 px-2 py-0.5 text-[10px] text-aubergine">
          {sourceTitle(first)}
        </span>
        {rest.length > 0 && (
          <button
            onClick={() => setExpandedPills((e) => ({ ...e, [itemId]: !e[itemId] }))}
            className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold"
          >
            +{rest.length} more
          </button>
        )}
        {expandedPills[itemId] && rest.length > 0 && (
          <div className="absolute left-0 top-6 z-10 w-56 rounded-lg border border-gold-light/40 bg-white p-2 shadow-lg">
            {itemSources.map((s) => (
              <div key={s.recipe_id} className="flex justify-between py-0.5 text-xs">
                <span>{sourceTitle(s)}</span>
                <span className="text-ink/50">
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
    if (groupBy === 'staples-first') {
      const staples = items.filter(i => i.is_staple_origin);
      const recipes = items.filter(i => !i.is_staple_origin);
      return [
        { title: 'Staples', items: staples },
        { title: 'Recipe Ingredients', items: recipes }
      ];
    }
    if (groupBy === 'by-recipe') {
      const groupsMap: Record<string, { title: string; items: ShoppingListItem[] }> = {};
      for (const item of items) {
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
    const byCategory = items.reduce(
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

  if (loading) {
    return <div className="text-center py-12 text-ink/50">Loading shopping list...</div>;
  }

  const groups = groupItems();

  return (
    <div className="space-y-4">
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>

      {/* Share / Print */}
      <div className="print:hidden flex items-center justify-end gap-3 text-ink/60">
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
                ? 'bg-aubergine text-cream'
                : 'bg-gold-light/20 text-aubergine hover:bg-gold-light/30'
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
              <h3 className="text-sm font-semibold text-aubergine bg-gold-light/20 px-3 py-2 rounded-lg">
                {group.title} ({group.items.length})
              </h3>

              {group.items.map(item => (
                <div
                  key={item.item_id}
                  className={`p-3 rounded-lg border transition-colors ${
                    item.status === 'purchased'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-gold-light/20 hover:border-gold-light/40'
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
                            onError={() =>
                              setBrokenPhotoIds((prev) => new Set(prev).add(item.item_id))
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 h-16 w-16 rounded bg-gold-light/10 flex items-center justify-center text-xs text-ink/40">
                          No photo
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Name + Status */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <h4
                              className={`font-medium text-sm ${
                                item.status === 'purchased' ? 'line-through text-ink/50' : 'text-ink'
                              }`}
                            >
                              {item.name}
                            </h4>
                            <p className="text-xs text-ink/60 mt-0.5">
                              {item.supplier && <span>{item.supplier} · </span>}
                              {item.category}
                            </p>
                            {recipePills(item.item_id)}
                          </div>
                          <button
                            onClick={() => toggleStatus(item.item_id, item.status)}
                            className="print:hidden flex-shrink-0 text-aubergine hover:text-emerald-700 transition-colors"
                          >
                            {item.status === 'purchased' ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                        </div>

                        {/* Stock + Location */}
                        <div className="flex items-center gap-2 mb-2 text-xs text-ink/60">
                          {item.current_stock !== null && (
                            <span className="bg-gold-light/20 px-2 py-0.5 rounded-full">
                              In stock: {item.current_stock}
                            </span>
                          )}
                          {item.location_name && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">
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
                              className="inline-flex items-center gap-1 text-xs text-gold hover:text-aubergine transition-colors font-medium"
                            >
                              Reorder <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-ink/30">No reorder link</span>
                          )}
                          <button
                            onClick={() => deleteItem(item.item_id)}
                            className="ml-auto text-ink/40 hover:text-rust transition-colors"
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
                            item.status === 'purchased' ? 'line-through text-ink/50' : 'text-ink'
                          }`}
                        >
                          {item.name}
                        </h4>
                        <p className="text-xs text-ink/60 mt-0.5">{item.category}</p>
                        {recipePills(item.item_id)}
                      </div>

                      <div className="print:hidden flex items-center gap-2">
                        <button
                          onClick={() => toggleStatus(item.item_id, item.status)}
                          className="text-aubergine hover:text-emerald-700 transition-colors"
                        >
                          {item.status === 'purchased' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteItem(item.item_id)}
                          className="text-ink/40 hover:text-rust transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
      )}

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-ink/40">Shopping list is empty</p>
        </div>
      )}

      <div className="text-xs text-ink/40 pt-2 border-t border-gold-light/20">
        {items.length} items total
      </div>
    </div>
  );
}
