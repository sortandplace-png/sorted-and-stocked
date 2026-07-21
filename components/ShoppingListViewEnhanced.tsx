// components/ShoppingListViewEnhanced.tsx
// Shopping list with conditional rendering: rich inventory cards OR plain text fallback
'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  fetchEnhancedShoppingList,
  fetchItemSources,
  updateShoppingItemStatus,
  updatePurchaseQty,
  removeShoppingItem,
  type ShoppingItemSource,
} from '@/lib/api/shoppingList';
import { Trash2, CheckCircle2, Circle, Printer, Sparkles, MoreVertical, ShoppingCart, AlertTriangle, Repeat, Store, BookOpen, MapPin } from 'lucide-react';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { getPreferredSource, type ReorderSource } from '@/lib/reorder-sources';
import OrderLink from '@/components/OrderLink';
import PhotoOrFallback from '@/components/PhotoOrFallback';
import Pin from '@/components/PinAccent';

type ShoppingListItem = {
  item_id: string;
  name: string;
  name_es: string | null;
  category: string;
  qty_needed: number;
  purchase_qty: number | null;
  unit_estimate: string | null;
  status: 'pending' | 'purchased' | 'archived';
  // Rich inventory fields (null if not linked)
  inventory_item_id: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
  current_stock: number | null;
  location_name: string | null;
  supplier: string | null;
  kosher_type: string | null;
  // UI flags
  is_rich_item: boolean;
  is_staple_origin: boolean;
  pesach_status: 'kosher_for_pesach' | 'not_kosher_for_pesach' | 'needs_review' | null;
};

// Same kashrut color tokens used elsewhere this session (Month view dots,
// dashboard's KASHRUT_INFO) -- keyed here by the real inventory_items.
// kosher_type values instead of a name-guessing heuristic.
const KOSHER_PILL_STYLE: Record<string, string> = {
  Meat: 'bg-rust/15 text-rust',
  Dairy: 'bg-dairy/15 text-dairy',
  Parve: 'bg-sage/15 text-sage',
};

type GroupBy = 'staples-first' | 'category' | 'by-recipe' | 'by-store';

// Present only on display rows produced by aggregateDuplicates — carries
// the real underlying row ids so toggling/deleting an aggregated row still
// acts on every real row it represents, not just the first one.
type DisplayItem = ShoppingListItem & { _mergedIds?: string[] };

export default function ShoppingListViewEnhanced({
  propertyId,
  shoppingListId,
  pesachModeEnabled = false,
}: {
  propertyId: string;
  shoppingListId: string;
  pesachModeEnabled?: boolean;
}) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [sources, setSources] = useState<Record<string, ShoppingItemSource[]>>({});
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('staples-first');
  const [expandedPills, setExpandedPills] = useState<Record<string, boolean>>({});
  const [aggregateDuplicates, setAggregateDuplicates] = useState(true);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Collapsible sections -- same pattern as the Recipes grid's letter
  // headers (title + count + chevron), applied to whichever grouping is
  // active (Staples/Recipe Ingredients, aisle categories, or recipes).
  // Seeded to "everything collapsed" on load and on groupBy switch (see
  // the effect below) rather than starting empty, so a 124-item list
  // doesn't dump open by default.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // All checked-off items (across every group) live in one collapsed
  // "Completed" section at the page bottom instead of inline with pending
  // items -- matches a real shopping trip, where you don't want a crossed-
  // off item still competing for attention next to what's left to buy.
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  // "Convenient to grab" tier -- items between min_qty and a slightly
  // higher comfortable level (1.5x min_qty, rounded up), distinct from
  // the real shopping_list_items rows above: those only ever get added
  // once an item is genuinely below min_qty (handle_low_stock trigger),
  // so this tier was never going to show up on the real list on its own.
  // Read-only advisory, not written anywhere -- default off so the list
  // stays tight unless someone opts into the wider view.
  const [showNiceToHave, setShowNiceToHave] = useState(false);
  const [niceToHaveItems, setNiceToHaveItems] = useState<
    { id: string; name: string; name_es: string | null; category: string | null; current_qty: number; min_qty: number; unit: string; photo_url: string | null }[]
  >([]);
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

  // Fetched lazily -- only once the toggle is actually turned on, so
  // opting into the wider view doesn't cost every visit a query for a
  // section most people leave off. min_qty > 0 excludes items with no
  // real par level set (a comfortable ceiling of 0 is meaningless there).
  useEffect(() => {
    if (!showNiceToHave) return;
    supabase
      .from('inventory_items')
      .select('id, name, name_es, category, current_qty, min_qty, unit, photo_url')
      .eq('property_id', propertyId)
      .gt('min_qty', 0)
      .then(({ data }) => {
        const comfortable = (row: { current_qty: number; min_qty: number }) =>
          row.current_qty >= row.min_qty && row.current_qty < Math.ceil(row.min_qty * 1.5);
        setNiceToHaveItems((data ?? []).filter(comfortable).sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, [showNiceToHave, propertyId, supabase]);

  // Seeds "everything collapsed" once when the list first has data, and
  // again whenever the grouping mode changes (a fresh set of group titles
  // the user hasn't interacted with yet) — but not on every items change,
  // so toggling/checking an item doesn't re-collapse a group the user just
  // opened.
  useEffect(() => {
    if (items.length === 0) return;
    const pendingRaw = items.filter((i) => i.status !== 'purchased');
    const titles = bucketByMode(pendingRaw, groupBy).map((g) => g.title);
    setCollapsedGroups(new Set(titles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, items.length > 0]);

  const savePurchaseQty = async (itemId: string, raw: string) => {
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    const prev = items.find((i) => i.item_id === itemId)?.purchase_qty ?? null;
    if (value === prev) return;
    setItems((p) => p.map((i) => (i.item_id === itemId ? { ...i, purchase_qty: value } : i)));
    try {
      await updatePurchaseQty(itemId, value);
    } catch (error) {
      console.error('Error updating purchase quantity:', error);
      setItems((p) => p.map((i) => (i.item_id === itemId ? { ...i, purchase_qty: prev } : i)));
      showToast('Failed to update purchase quantity.', { variant: 'error' });
    }
  };

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

  // Merged items (mergedCount > 1) previously showed zero recipe pills --
  // recipePills used to look up sources by a single item_id, but a merged
  // display row's item_id is only the first underlying row's id, so every
  // other real row's sources were silently dropped. Now looks up sources
  // across every underlying id the merged row represents.
  function recipePills(item: DisplayItem) {
    const ids = item._mergedIds ?? [item.item_id];
    const itemSources = ids.flatMap((id) => sources[id] ?? []);
    if (itemSources.length === 0) return null;
    const [first, ...rest] = itemSources;
    const itemId = item.item_id;
    return (
      <div className="relative flex items-center gap-1 mt-1">
        <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-denim">
          {sourceTitle(first)}
        </span>
        {rest.length > 0 && (
          <button
            onClick={() => setExpandedPills((e) => ({ ...e, [itemId]: !e[itemId] }))}
            className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-medium text-brass"
          >
            +{rest.length} more
          </button>
        )}
        {expandedPills[itemId] && rest.length > 0 && (
          <div className="absolute left-0 top-6 z-10 w-56 rounded-lg border border-cardBorder bg-card p-2 shadow-cardHover">
            {itemSources.map((s, i) => (
              <div key={s.recipe_id + '_' + i} className="flex justify-between py-0.5 text-xs">
                <span>{sourceTitle(s)}</span>
                <span className="text-dusk">
                  {s.quantity ?? ''} {s.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // qty_needed is always 1 on every real row (a hardcoded default set on
  // insert, not a real amount) -- the actual per-recipe quantities live in
  // shopping_list_item_sources, the same data recipePills already reads.
  // Summed across every merged id so the quantity pill shows a real total
  // rather than a meaningless constant "1".
  function totalQuantity(item: DisplayItem): { qty: number; unit: string } | null {
    const ids = item._mergedIds ?? [item.item_id];
    const itemSources = ids.flatMap((id) => sources[id] ?? []);
    if (itemSources.length === 0) return null;
    const qty = itemSources.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
    if (qty <= 0) return null;
    const unit = itemSources.find((s) => s.unit)?.unit ?? '';
    return { qty, unit };
  }

  function displayName(item: DisplayItem) {
    return locale === 'es' && item.name_es ? item.name_es : item.name;
  }

  // Pesach Mode: flag inline rather than silently including -- true only
  // when a real Pesach-tagged recipe pulled this item in AND the linked
  // inventory item isn't cleared (not_kosher_for_pesach or still
  // needs_review). An item with no inventory link at all (pesach_status
  // null) has nothing to flag against.
  function pesachFlag(item: DisplayItem): boolean {
    if (!pesachModeEnabled || !item.pesach_status || item.pesach_status === 'kosher_for_pesach') return false;
    const ids = item._mergedIds ?? [item.item_id];
    const itemSources = ids.flatMap((id) => sources[id] ?? []);
    return itemSources.some((s) => s.is_pesach);
  }

  function secondaryName(item: DisplayItem) {
    return locale === 'es' ? item.name : item.name_es;
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

  // Buckets one item list (either all-pending or all-purchased) into the
  // active groupBy mode's real groups. Shared by both buckets below so
  // checked items land in the *same* named group as their pending
  // counterparts instead of one global "Completed" pile.
  function bucketByMode(
    rawItems: DisplayItem[],
    mode: GroupBy = groupBy
  ): { title: string; photoUrl?: string | null; items: DisplayItem[] }[] {
    // Aggregating collapses same-name rows from different recipes into one
    // display row, which would make "By Recipe" grouping lose its meaning
    // (a merged row can't cleanly belong to a single recipe group) — so
    // aggregation only applies outside that view.
    const bucketItems: DisplayItem[] = mode === 'by-recipe' ? rawItems : aggregateItems(rawItems);

    if (mode === 'staples-first') {
      // is_staple_origin depends on the item being linked to a real
      // inventory_item that also matches a configured staple -- right now
      // that's 0 of 132 pending items (nothing is inventory-linked yet, a
      // separate backlog), so the old flat "everything not staple-origin
      // dumps into one Recipe Ingredients pile" read as one long undifferen-
      // tiated list. Sub-grouping the non-staple bucket by aisle (same
      // grouping "By Aisle" uses) makes it useful with today's real data;
      // the Staples bucket still surfaces first, above the aisle groups,
      // whenever it's non-empty, so this stays correct as linking improves.
      const staples = bucketItems.filter((i) => i.is_staple_origin);
      const rest = bucketItems.filter((i) => !i.is_staple_origin);

      const byCategory = rest.reduce(
        (acc, item) => {
          const cat = item.category || 'Other';
          (acc[cat] ??= []).push(item);
          return acc;
        },
        {} as Record<string, DisplayItem[]>
      );
      const categoryGroups = Object.entries(byCategory)
        .map(([title, items]) => ({ title, items }))
        .sort((a, b) => {
          if (a.title === 'Other') return 1;
          if (b.title === 'Other') return -1;
          return a.title.localeCompare(b.title);
        });

      return staples.length > 0 ? [{ title: 'Staples', items: staples }, ...categoryGroups] : categoryGroups;
    }
    if (mode === 'by-recipe') {
      const groupsMap: Record<string, { title: string; photoUrl: string | null; items: DisplayItem[] }> = {};
      for (const item of bucketItems) {
        const itemSources = sources[item.item_id];
        const primary = itemSources?.[0];
        const key = primary?.recipe_id ?? 'unassigned';
        const title = primary ? sourceTitle(primary) : 'Other';
        (groupsMap[key] ??= { title, photoUrl: primary?.recipe_photo_url ?? null, items: [] }).items.push(item);
      }
      return Object.values(groupsMap).sort((a, b) => {
        if (a.title === 'Other') return 1;
        if (b.title === 'Other') return -1;
        return a.title.localeCompare(b.title);
      });
    }
    if (mode === 'by-store') {
      // Groups by each item's own preferred reorder source (the same
      // is_preferred pick OrderLink/ReorderSourcePicker already use
      // elsewhere) -- an item with no reorder_sources at all falls into
      // "Other" rather than disappearing, same convention as the other
      // modes' uncategorized bucket.
      const byStore = bucketItems.reduce(
        (acc, item) => {
          const store = getPreferredSource(item.reorder_sources)?.retailer_name || 'Other';
          (acc[store] ??= []).push(item);
          return acc;
        },
        {} as Record<string, DisplayItem[]>
      );
      return Object.entries(byStore)
        .map(([title, items]) => ({ title, items }))
        .sort((a, b) => {
          if (a.title === 'Other') return 1;
          if (b.title === 'Other') return -1;
          return a.title.localeCompare(b.title);
        });
    }
    const byCategory = bucketItems.reduce(
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
  }

  // Only pending items get grouped into Staples/aisle/recipe sections --
  // checked-off items move out entirely into the one global Completed
  // section at the page bottom (see the render below), so a crossed-off
  // item stops competing for attention next to what's still left to buy.
  const groupItems = (): { title: string; photoUrl?: string | null; items: DisplayItem[] }[] => {
    const pendingRaw = items.filter((i) => i.status !== 'purchased');
    return bucketByMode(pendingRaw);
  };

  function renderItemCard(item: DisplayItem) {
    const mergedCount = item._mergedIds?.length ?? 1;
    const isChecked = item.status === 'purchased';
    const qty = totalQuantity(item);
    const kosherStyle = item.kosher_type ? KOSHER_PILL_STYLE[item.kosher_type] : null;
    const secondary = secondaryName(item);

    return (
      <div
        key={item.item_id}
        className={`rounded-lg border bg-card border-cardBorder hover:border-brass/30 transition-colors ${
          density === 'compact' ? 'p-2' : 'p-3'
        } ${isChecked ? 'opacity-60' : ''}`}
      >
        <div className="flex gap-3">
          {/* Checkbox first, per the card redesign order */}
          <button
            onClick={() => toggleStatusForDisplayItem(item)}
            disabled={isItemProcessing(item)}
            className={`print:hidden flex-shrink-0 mt-0.5 text-denim hover:text-sage transition-colors ${
              isItemProcessing(item) ? 'opacity-40 cursor-wait' : ''
            }`}
          >
            {isChecked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </button>

          <PhotoOrFallback src={item.photo_url} alt={item.name} sizeClass="h-14 w-14" rounded="rounded" />

          <div className="flex-1 min-w-0">
            {/* Name + qty + cart on one real row, matching Low Stock
                Alerts' own pattern exactly (DashboardWidgets.tsx's
                LowStockAlertsCard): name truncates in its own flex-1
                min-w-0 element, qty is a separate shrink-0 sibling so it
                can never get squeezed out or pushed to a second line by a
                long name -- previously qty lived inside the same truncating
                h4 as the name, competing for the same single-line text run.
                Cart replaces the old "Reorder" text link that used to sit
                much further down, past supplier/stock/location -- same
                OrderLink component used site-wide now (dashboard tiles,
                Inventory), always clickable (falls back to an Amazon
                search when there's no configured source, never blank).
                Delete moves up here too rather than staying on its own
                bottom row. */}
            <div className="flex items-center gap-2">
              <h4 className={`min-w-0 flex-1 truncate font-medium text-sm ${isChecked ? 'line-through text-dusk' : 'text-denim'}`}>
                {displayName(item)}
                {mergedCount > 1 && <span className="text-dusk font-normal"> ×{mergedCount}</span>}
              </h4>
              {qty && (
                <span className={`shrink-0 text-xs font-normal ${isChecked ? 'line-through text-dusk' : 'text-dusk'}`}>
                  {Math.round(qty.qty * 100) / 100} {qty.unit}
                </span>
              )}
              <span className="print:hidden shrink-0">
                <OrderLink itemName={item.name} sources={item.reorder_sources} fallbackLink={item.reorder_link} />
              </span>
              <button
                onClick={() => deleteDisplayItem(item)}
                className="print:hidden shrink-0 text-dusk hover:text-rust transition-colors"
                aria-label={`Remove ${displayName(item)}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {secondary && (
              <p className={`text-xs italic ${isChecked ? 'line-through text-dusk' : 'text-dusk'}`}>
                {secondary}
              </p>
            )}

            {/* Kosher-type pill on its own, now that qty moved up to the
                name row. */}
            {item.kosher_type && kosherStyle && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${kosherStyle}`}>
                  {item.kosher_type}
                </span>
              </div>
            )}

            {/* Purchase quantity: "how many units to buy", distinct from
                qty_needed (the recipe-derived amount shown in the pill
                above). Only shown on non-merged rows -- a merged row
                represents multiple real underlying rows combined for
                display, and there's no single correct real row to write a
                typed value to (same reason "By Recipe" grouping disables
                aggregation entirely). */}
            {mergedCount === 1 && (
              <div className="print:hidden flex items-center gap-1.5 mt-1.5">
                <label htmlFor={`purchase-qty-${item.item_id}`} className="text-[10px] text-dusk">
                  {t('purchaseQtyLabel')}
                </label>
                <input
                  id={`purchase-qty-${item.item_id}`}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  defaultValue={item.purchase_qty ?? ''}
                  key={`${item.item_id}-${item.purchase_qty ?? ''}`}
                  placeholder={t('purchaseQtyPlaceholder')}
                  onBlur={(e) => savePurchaseQty(item.item_id, e.target.value)}
                  className="w-16 rounded-md border border-cardBorder px-1.5 py-0.5 text-[11px] text-denim focus:outline-none focus:ring-1 focus:ring-brass"
                />
              </div>
            )}
            {item.purchase_qty !== null && (
              <p className="hidden print:block text-[10px] text-dusk">
                {t('purchaseQtyLabel')}: {item.purchase_qty}
              </p>
            )}

            {recipePills(item)}

            {pesachFlag(item) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rust bg-rust/10 px-2.5 py-1 rounded-full w-fit">
                <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                {item.pesach_status === 'needs_review' ? 'Pesach status not yet reviewed' : 'Not cleared for Pesach'}
              </div>
            )}

            {item.is_rich_item ? (
              <div className="flex items-center gap-2 mt-2 text-xs text-dusk flex-wrap">
                {item.supplier && (
                  <span className="bg-mist px-2 py-0.5 rounded-full">{item.supplier}</span>
                )}
                {item.current_stock !== null && (
                  <span className="bg-mist px-2 py-0.5 rounded-full">
                    In stock: {item.current_stock}
                  </span>
                )}
                {item.location_name && (
                  <span className="bg-mist px-2 py-0.5 rounded-full text-dusk">
                    📍 {item.location_name}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-dusk">{item.category}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-dusk">Loading shopping list...</div>;
  }

  const groups = groupItems();
  const completedItems = items.filter((i) => i.status === 'purchased');

  return (
    <div className="space-y-4">
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>

      {/* Share promoted out to the toolbar itself (SS-148 follow-up) --
          previously only reachable via More options, two taps deep. Kept
          out of the dropdown below entirely now that it lives here, rather
          than leaving two paths to the same action. */}
      <div className="print:hidden relative flex items-center justify-end gap-1">
        <button
          onClick={shareWhatsApp}
          className="flex items-center gap-1.5 text-sm font-medium text-denim hover:text-brass px-2 py-1 rounded-full transition-colors"
        >
          <WhatsAppIcon size={16} />
          Share
        </button>
        <button
          onClick={() => setShowMoreMenu((v) => !v)}
          aria-label="More options"
          title="More options"
          className="text-dusk hover:text-denim p-1"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMoreMenu && (
          <div
            className="absolute right-0 top-8 z-20 w-64 rounded-2xl border border-cardBorder bg-card shadow-cardHover p-3 space-y-3"
            onMouseLeave={() => setShowMoreMenu(false)}
          >
            <label className="flex items-center justify-between text-sm text-denim">
              <span>Aggregate duplicates</span>
              <input
                type="checkbox"
                checked={aggregateDuplicates}
                onChange={(e) => setAggregateDuplicates(e.target.checked)}
                className="h-4 w-4 accent-brass rounded"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-denim">
              <span>Show "convenient to grab" items</span>
              <input
                type="checkbox"
                checked={showNiceToHave}
                onChange={(e) => setShowNiceToHave(e.target.checked)}
                className="h-4 w-4 accent-brass rounded"
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
            <div className="border-t border-cardBorder pt-3">
              <p className="text-xs text-dusk mb-1.5">Density</p>
              <div className="inline-flex rounded-full border border-cardBorder bg-card p-0.5 text-xs">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`rounded-full px-3 py-1 capitalize ${
                      density === d ? 'bg-denim text-white' : 'text-dusk'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-cardBorder pt-3">
              <button
                onClick={() => {
                  window.print();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-1.5 text-sm text-dusk hover:text-denim"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Options -- tile, not pill (2026-07-20, RULE 2): was a row of
          rounded-full capsules, the exact generic-chip shape FilterPill.tsx
          already replaced elsewhere in the app. Same rounded-xl2/bg-mist/
          border-brass tile language, sized for 3 view-mode buttons rather
          than FilterPill itself -- these aren't a filter with a count,
          just a 3-way display-mode switch, so no "(N)" line under the
          label the way a real filter tile has one. */}
      <div className="print:hidden flex gap-2">
        {([
          ['staples-first', Repeat, 'Staples'] as const,
          ['category', Store, 'By Aisle'] as const,
          ['by-recipe', BookOpen, 'By Recipe'] as const,
          ['by-store', MapPin, 'By Store'] as const,
        ]).map(([option, Icon, label]) => (
          <button
            key={option}
            onClick={() => setGroupBy(option)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-xl2 border px-2 py-2.5 shadow-card transition-colors ${
              groupBy === option ? 'bg-denim border-denim' : 'bg-mist border-brass/30 hover:bg-card'
            }`}
          >
            <Icon className={`w-4 h-4 ${groupBy === option ? 'text-white' : 'text-brass'}`} strokeWidth={1.75} aria-hidden="true" />
            {/* Renamed per request -- confirmed this toggle and the
                resulting "Staples (N)" group card below are the exact same
                mechanism (is_staple_origin), not a collision with a
                separate concept. */}
            <span className={`text-[11px] font-medium ${groupBy === option ? 'text-white' : 'text-denim'}`}>{label}</span>
          </button>
        ))}
      </div>

      {/* Items Grouped -- collapsed by default (title + count only) until
          tapped open. Each group is its own bordered card in a 2-column
          desktop grid (1-column on mobile), matching StaplesTab's card
          treatment so both tabs feel like the same app rather than two
          different styles. Checked-off items don't appear here at all --
          they move to the single Completed section below. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {groups.map(group => {
          if (group.items.length === 0) return null;
          const collapsed = collapsedGroups.has(group.title);
          return (
            <div
              key={group.title}
              className="bg-card rounded-2xl border border-cardBorder shadow-card p-4"
            >
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center gap-2 mb-3 text-left"
              >
                {/* By Recipe only -- group.photoUrl is undefined in every
                    other grouping mode (category/aisle titles aren't
                    recipes and have no photo to show). Same photo-or-
                    fallback treatment as item cards elsewhere in this file. */}
                {group.photoUrl !== undefined && (
                  <span className="w-8 h-8 rounded-md overflow-hidden bg-mist shrink-0 flex items-center justify-center">
                    {group.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={group.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm" aria-hidden="true">🍽️</span>
                    )}
                  </span>
                )}
                <span className="font-display text-lg text-denim">{group.title}</span>
                <span className="text-xs text-dusk">({group.items.length})</span>
                <span className="flex-1 border-t border-cardBorder" />
                <span className="text-dusk text-sm">{collapsed ? '▸' : '▾'}</span>
              </button>
              {!collapsed && <div className="space-y-2">{group.items.map(renderItemCard)}</div>}
            </div>
          );
        })}
      </div>

      {/* Convenient to grab -- read-only advisory, not real shopping_list_items
          rows (nothing here is checkable/purchasable/deletable the way the
          groups above are). Sits between the real list and Completed:
          secondary to what's actually needed, but still worth seeing before
          the fully-done section at the very bottom. */}
      {showNiceToHave && (
        <div className="relative print:hidden bg-card rounded-2xl border border-cardBorder shadow-card p-4">
          <Pin size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <span className="font-display text-lg text-dusk">Convenient to grab</span>
            <span className="text-xs text-dusk">({niceToHaveItems.length})</span>
          </div>
          <p className="text-xs text-dusk mb-3">
            Not low yet, but close -- worth grabbing if you're already buying nearby stuff.
          </p>
          {niceToHaveItems.length === 0 ? (
            <p className="text-sm text-dusk">Nothing sitting in that range right now.</p>
          ) : (
            <ul className="space-y-1.5">
              {niceToHaveItems.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  {item.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photo_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0 bg-mist" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-mist flex-shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm text-dusk">
                    {locale === 'es' && item.name_es ? item.name_es : item.name}
                  </span>
                  <span className="shrink-0 text-xs text-dusk">
                    {item.current_qty} / {item.min_qty} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Completed -- every checked-off item, regardless of group, in one
          collapsed section at the bottom. Cards already render checked
          items at reduced opacity with strikethrough text (renderItemCard's
          isChecked styling), unchanged here. */}
      {completedItems.length > 0 && (
        <div className="print:hidden bg-card rounded-2xl border border-cardBorder shadow-card p-4">
          <button
            onClick={() => setCompletedExpanded((v) => !v)}
            className="w-full flex items-center gap-2 text-left"
          >
            <span className="font-display text-lg text-dusk">Completed</span>
            <span className="text-xs text-dusk">({completedItems.length})</span>
            <span className="flex-1 border-t border-cardBorder" />
            <span className="text-dusk text-sm">{completedExpanded ? '▾' : '▸'}</span>
          </button>
          {completedExpanded && (
            <div className="space-y-2 mt-3">{aggregateItems(completedItems).map(renderItemCard)}</div>
          )}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-mist flex items-center justify-center">
            <ShoppingCart className="h-6 w-6 text-brass" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <p className="text-sm text-dusk mb-1">{t('emptyTitle')}</p>
          <p className="text-xs text-dusk mb-4">{t('emptySubtitle')}</p>
          <button
            onClick={handleGenerateFromWeek}
            disabled={generating}
            className="inline-flex items-center gap-1.5 bg-denim text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? t('generating') : t('generateFromWeek')}
          </button>
        </div>
      )}

      <div className="text-xs text-dusk pt-2 border-t border-cardBorder">
        {items.length} items total
      </div>
    </div>
  );
}
