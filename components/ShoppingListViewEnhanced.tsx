// components/ShoppingListViewEnhanced.tsx
// Shopping list with conditional rendering: rich inventory cards OR plain text fallback
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink, Trash2, CheckCircle2, Circle } from 'lucide-react';
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

export default function ShoppingListViewEnhanced({ shoppingListId }: { shoppingListId: string }) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'category' | 'staples-first'>('staples-first');
  const supabase = createClient();
  const showToast = useToast();

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_shopping_list_with_inventory', {
      p_shopping_list_id: shoppingListId
    });

    if (error) {
      console.error('Error loading shopping list:', error);
      showToast('Failed to load shopping list.', { variant: 'error' });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [shoppingListId]);

  const toggleStatus = async (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'purchased' ? 'pending' : 'purchased';
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ status: newStatus })
      .eq('id', itemId);

    if (error) {
      showToast('Failed to update item.', { variant: 'error' });
      return;
    }

    setItems(prev =>
      prev.map(item => (item.item_id === itemId ? { ...item, status: newStatus } : item))
    );
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ status: 'deleted' })
      .eq('id', itemId);

    if (error) {
      showToast('Failed to delete item.', { variant: 'error' });
      return;
    }

    setItems(prev => prev.filter(item => item.item_id !== itemId));
    showToast('Item removed.', { variant: 'success' });
  };

  const groupItems = () => {
    if (groupBy === 'staples-first') {
      const staples = items.filter(i => i.is_staple_origin);
      const recipes = items.filter(i => !i.is_staple_origin);
      return [
        { title: 'Staples', items: staples },
        { title: 'Recipe Ingredients', items: recipes }
      ];
    } else {
      const byCategory = items.reduce(
        (acc, item) => {
          const cat = item.category || 'Other';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
        },
        {} as Record<string, ShoppingListItem[]>
      );
      return Object.entries(byCategory).map(([title, items]) => ({ title, items }));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-ink/50">Loading shopping list...</div>;
  }

  const groups = groupItems();

  return (
    <div className="space-y-4">
      {/* View Options */}
      <div className="flex gap-2">
        {(['staples-first', 'category'] as const).map(option => (
          <button
            key={option}
            onClick={() => setGroupBy(option)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              groupBy === option
                ? 'bg-aubergine text-cream'
                : 'bg-gold-light/20 text-aubergine hover:bg-gold-light/30'
            }`}
          >
            {option === 'staples-first' ? 'Staples First' : 'By Category'}
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
                      {item.photo_url ? (
                        <div className="flex-shrink-0">
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="h-16 w-16 rounded object-cover bg-gold-light/10"
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
                          </div>
                          <button
                            onClick={() => toggleStatus(item.item_id, item.status)}
                            className="flex-shrink-0 text-aubergine hover:text-emerald-700 transition-colors"
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
                        <div className="flex items-center gap-2">
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
                      </div>

                      <div className="flex items-center gap-2">
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
