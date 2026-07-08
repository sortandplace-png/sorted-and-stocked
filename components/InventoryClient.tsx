// components/InventoryClient.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { categoryIcon } from '@/lib/icon-maps';

type StorageLocation = {
  id: string;
  name: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  location_id: string | null;
  current_qty: number;
  min_qty: number;
  unit: string;
  supplier: string | null;
  unit_cost: number | null;
  reorder_link: string | null;
  photo_url: string | null;
};

type HistoryEntry = {
  id: string;
  action_type: 'created' | 'updated' | 'quantity_changed' | 'deleted';
  actor_name: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

type ItemFormState = {
  id: string | null; // null = creating new
  name: string;
  category: string;
  location_id: string;
  current_qty: string;
  min_qty: string;
  unit: string;
  supplier: string;
  unit_cost: string;
  reorder_link: string;
  photo_url: string;
};

const EMPTY_FORM: ItemFormState = {
  id: null,
  name: '',
  category: '',
  location_id: '',
  current_qty: '0',
  min_qty: '0',
  unit: 'pcs',
  supplier: '',
  unit_cost: '',
  reorder_link: '',
  photo_url: '',
};

// Plain Drive "file/d/.../view" links aren't directly viewable as <img> src.
// Drive's thumbnail endpoint CAN be hotlinked for shared files, though —
// so that specific format is treated as valid even though it's still a
// drive.google.com URL.
function isDirectImageUrl(url: string) {
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

const UNASSIGNED = 'Unassigned';
const FAVORITES = '__favorites__';

export default function InventoryClient({
  propertyId,
  initialLocationFilter = null,
}: {
  propertyId: string;
  initialLocationFilter?: string | null;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState | null>(null); // null = form closed
  const [saving, setSaving] = useState(false);
  // Arrived here via a location QR scan — start filtered to that area, but
  // let the user clear it to see everything.
  const [locationFilter, setLocationFilter] = useState<string | null>(initialLocationFilter);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  // Tracks item IDs whose photo failed to actually load (dead link, 404,
  // etc.) — isDirectImageUrl only checks the URL *shape*, not whether the
  // image is reachable, so a broken link would otherwise render as the
  // browser's broken-image icon instead of falling back to the category icon.
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const role = usePropertyRole();
  const showToast = useToast();
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const [itemsRes, locationsRes, categoriesRes, favoritesRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, name, location_id, current_qty, min_qty, unit, supplier, unit_cost, reorder_link, photo_url, category')
        .eq('property_id', propertyId)
        .order('name'),
      supabase.from('locations').select('id, name').eq('property_id', propertyId).order('name'),
      // Fetch all available categories for autocomplete suggestions
      supabase
        .from('categories')
        .select('name')
        .order('name'),
      user
        ? supabase
            .from('inventory_item_favorites')
            .select('inventory_item_id')
            .eq('property_id', propertyId)
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] as { inventory_item_id: string }[] }),
    ]);

    if (itemsRes.error) setError(itemsRes.error.message);
    setItems(itemsRes.data ?? []);
    setLocations(locationsRes.data ?? []);
    setCategorySuggestions([...new Set((categoriesRes.data ?? []).map((c) => c.name))]);
    setFavoriteIds(new Set((favoritesRes.data ?? []).map((f) => f.inventory_item_id)));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleFavorite(itemId: string, e: React.MouseEvent) {
    e.stopPropagation(); // don't also open the edit sheet
    if (!currentUserId) return;

    const isFav = favoriteIds.has(itemId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(itemId) : next.add(itemId);
      return next;
    });

    if (isFav) {
      await supabase
        .from('inventory_item_favorites')
        .delete()
        .eq('property_id', propertyId)
        .eq('inventory_item_id', itemId)
        .eq('user_id', currentUserId);
    } else {
      await supabase
        .from('inventory_item_favorites')
        .insert({ property_id: propertyId, inventory_item_id: itemId, user_id: currentUserId })
        .select()
        .single();
      // A duplicate (already favorited from another tab) just no-ops via
      // the unique constraint — no need to handle that error specially.
    }
  }

  async function loadHistory(itemId: string) {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('inventory_item_history')
      .select('id, action_type, actor_name, field_name, old_value, new_value, created_at')
      .eq('inventory_item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(15);
    setHistory((data as HistoryEntry[]) ?? []);
    setHistoryLoading(false);
  }

  async function saveNewRoom() {
    if (!newRoomName.trim()) return;
    setSavingRoom(true);
    const { error: insertError } = await supabase
      .from('locations')
      .insert({ property_id: propertyId, name: newRoomName.trim() });
    setSavingRoom(false);

    if (insertError) {
      showToast('Failed to add room.', { variant: 'error' });
      return;
    }

    setShowNewRoom(false);
    setNewRoomName('');
    showToast('Room added.', { variant: 'success' });
    loadData();
  }

  const { pullDistance, refreshing } = usePullToRefresh(loadData);

  useEffect(() => {
    const timers = pendingDeleteTimers.current;
    return () => {
      // Navigating away mid-undo-window shouldn't silently cancel a delete
      // the person was already told happened — clear the timer but fire the
      // real delete immediately instead of dropping it.
      timers.forEach((timer, id) => {
        clearTimeout(timer);
        resilientDelete(supabase, 'inventory_items', { id });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNewItemForm() {
    setForm({ ...EMPTY_FORM, location_id: locations[0]?.id ?? '' });
  }

  function openEditForm(item: InventoryItem) {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category ?? '',
      location_id: item.location_id ?? '',
      current_qty: String(item.current_qty),
      min_qty: String(item.min_qty),
      unit: item.unit,
      supplier: item.supplier ?? '',
      unit_cost: item.unit_cost !== null ? String(item.unit_cost) : '',
      reorder_link: item.reorder_link ?? '',
      photo_url: item.photo_url ?? '',
    });
    setHistory([]);
    loadHistory(item.id);
  }

  async function saveForm() {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      property_id: propertyId,
      name: form.name.trim(),
      category: form.category.trim() || null,
      location_id: form.location_id || null,
      current_qty: Number(form.current_qty) || 0,
      min_qty: Number(form.min_qty) || 0,
      unit: form.unit.trim() || 'pcs',
      supplier: form.supplier.trim() || null,
      unit_cost: form.unit_cost.trim() ? Number(form.unit_cost) : null,
      reorder_link: form.reorder_link.trim() || null,
      photo_url: form.photo_url.trim() || null,
    };

    if (form.id) {
      const result = await resilientUpdate(supabase, 'inventory_items', { id: form.id }, payload);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        showToast('Failed to save item.', { variant: 'error' });
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === form.id ? { ...i, ...payload, id: form.id! } : i))
      );
      showToast(result.queued ? 'Saved — will sync when back online.' : 'Item saved.', {
        variant: 'success',
      });
    } else {
      const optimisticId = `pending-${crypto.randomUUID()}`;
      const result = await resilientInsert(supabase, 'inventory_items', payload);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        showToast('Failed to add item.', { variant: 'error' });
        return;
      }
      setItems((prev) => [...prev, { ...payload, id: optimisticId }]);
      showToast(result.queued ? 'Added — will sync when back online.' : 'Item added.', {
        variant: 'success',
      });
    }

    setForm(null);
  }

  async function deleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Optimistically remove right away — no confirm() dialog anymore, the
    // undo window replaces it as the safety net.
    setItems((prev) => prev.filter((i) => i.id !== id));
    setForm(null);

    const timer = setTimeout(async () => {
      pendingDeleteTimers.current.delete(id);
      const result = await resilientDelete(supabase, 'inventory_items', { id });
      if (!result.ok) {
        setError(result.error);
        showToast('Failed to delete item — it has been restored.', { variant: 'error' });
        setItems((prev) => [...prev, item]);
      }
    }, 5000);

    pendingDeleteTimers.current.set(id, timer);

    showToast(`Deleted "${item.name}".`, {
      variant: 'default',
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingDeleteTimers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            pendingDeleteTimers.current.delete(id);
          }
          setItems((prev) => [...prev, item]);
        },
      },
    });
  }

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? UNASSIGNED;

  const visibleItems = locationFilter
    ? locationFilter === UNASSIGNED
      ? items.filter((i) => i.location_id === null)
      : locationFilter === FAVORITES
      ? items.filter((i) => favoriteIds.has(i.id))
      : items.filter((i) => i.location_id === locationFilter)
    : items;

  const grouped = groupByLocation(visibleItems, locationName);

  if (loading) return <SkeletonList />;

  // Room summaries for the grid view — count + low-stock count per location.
  const roomSummaries = grouped.map(([location, locationItems]) => ({
    location,
    count: locationItems.length,
    lowCount: locationItems.filter((i) => i.current_qty < i.min_qty).length,
  }));

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center text-xs text-ink/40 overflow-hidden transition-all"
          style={{ height: refreshing ? 32 : pullDistance }}
        >
          {refreshing ? 'Refreshing…' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-aubergine">Inventory</h1>
        <div className="flex gap-2">
          <a
            href={`/properties/${propertyId}/scan`}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-aubergine/30 text-aubergine text-lg"
            aria-label="Scan a label"
          >
            📷
          </a>
          <button
            onClick={openNewItemForm}
            className="text-sm font-medium bg-aubergine text-cream px-4 py-2 rounded-full"
          >
            + Add item
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      {!locationFilter ? (
        // ---- Room grid: pick a room to see what's inside ----
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {favoriteIds.size > 0 && (
            <button
              onClick={() => setLocationFilter(FAVORITES)}
              className="text-left bg-gold-light/25 rounded-2xl shadow-sm shadow-aubergine/5 p-4 hover:bg-gold-light/40 transition-colors"
            >
              <p className="font-display text-lg text-aubergine truncate">⭐ Favorites</p>
              <p className="text-xs text-ink/50 mt-1">
                {favoriteIds.size} item{favoriteIds.size === 1 ? '' : 's'}
              </p>
            </button>
          )}
          {roomSummaries.map(({ location, count, lowCount }) => {
            const loc = locations.find((l) => l.name === location);
            return (
              <button
                key={location}
                onClick={() => setLocationFilter(loc ? loc.id : UNASSIGNED)}
                className="text-left bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4 hover:bg-gold-light/15 transition-colors"
              >
                <p className="font-display text-lg text-aubergine truncate">{location}</p>
                <p className="text-xs text-ink/50 mt-1">
                  {count} item{count === 1 ? '' : 's'}
                </p>
                {lowCount > 0 && (
                  <span className="inline-block mt-2 text-xs font-medium text-rust bg-rust/10 px-2 py-0.5 rounded-full">
                    {lowCount} low
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setShowNewRoom(true)}
            className="text-left border-2 border-dashed border-gold-light rounded-2xl p-4 text-aubergine/60 hover:bg-gold-light/10 transition-colors"
          >
            <p className="font-display text-lg">+ Add room</p>
          </button>
        </div>
      ) : (
        // ---- Single room's item list ----
        <>
          <button
            onClick={() => setLocationFilter(null)}
            className="flex items-center gap-1 text-sm text-aubergine mb-3 font-medium"
          >
            ← Rooms
          </button>
          <h2 className="font-display text-lg text-aubergine mb-2">
            {locationFilter === FAVORITES ? '⭐ Favorites' : locationName(locationFilter)}
          </h2>
          <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
            {visibleItems.map((item) => {
              const low = item.current_qty < item.min_qty;
              const hasThumb =
                !!item.photo_url && isDirectImageUrl(item.photo_url) && !brokenPhotoIds.has(item.id);
              const isFav = favoriteIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-aubergine/5 px-4 py-3.5 cursor-pointer hover:shadow-md hover:shadow-aubergine/10 transition-shadow"
                  onClick={() => openEditForm(item)}
                >
                  {hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photo_url!}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gold-light/20"
                      onError={() =>
                        setBrokenPhotoIds((prev) => new Set(prev).add(item.id))
                      }
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gold-light/20 shrink-0 flex items-center justify-center text-2xl">
                      {categoryIcon(item.category)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{item.name}</p>
                    <p className="text-xs text-ink/50 truncate mt-0.5">
                      {[item.category ? `${categoryIcon(item.category)} ${item.category}` : null, item.supplier]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-1.5">
                      {low ? (
                        <span className="text-xs font-medium text-rust bg-rust/10 px-2.5 py-1 rounded-full">
                          {item.current_qty} / {item.min_qty} {item.unit} — low
                        </span>
                      ) : (
                        <span className="text-xs text-ink/40">
                          {item.current_qty} / {item.min_qty} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => toggleFavorite(item.id, e)}
                    className="text-xl shrink-0 self-start"
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFav ? '⭐' : '☆'}
                  </button>
                  {item.reorder_link && (
                    <a
                      href={item.reorder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xl shrink-0 self-start"
                      aria-label="Open reorder link"
                    >
                      🛒
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {visibleItems.length === 0 && (
        <p className="text-sm text-ink/40 text-center mt-8">
          {locationFilter === FAVORITES
            ? 'No favorites yet — tap the star on any item.'
            : locationFilter
            ? 'No items in this area yet.'
            : 'No items yet. Tap "Add item" to get started.'}
        </p>
      )}

      {form && (
        <ItemFormSheet
          form={form}
          locations={locations}
          categorySuggestions={categorySuggestions}
          saving={saving}
          onChange={setForm}
          onCancel={() => setForm(null)}
          onSave={saveForm}
          onDelete={form.id && canManage(role) ? () => deleteItem(form.id!) : undefined}
          history={history}
          historyLoading={historyLoading}
        />
      )}

      {showNewRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setShowNewRoom(false)}>
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-aubergine mb-3">New room</h2>
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. Kitchen Pantry"
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveNewRoom()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewRoom(false)}
                className="flex-1 py-2.5 rounded-full border border-aubergine/30 text-aubergine"
              >
                Cancel
              </button>
              <button
                onClick={saveNewRoom}
                disabled={savingRoom || !newRoomName.trim()}
                className="flex-1 py-2.5 rounded-full bg-aubergine text-cream disabled:opacity-40"
              >
                {savingRoom ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function groupByLocation(
  items: InventoryItem[],
  locationName: (id: string | null) => string
): [string, InventoryItem[]][] {
  const groups = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = locationName(item.location_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  });
}

function ItemFormSheet({
  form,
  locations,
  categorySuggestions,
  saving,
  onChange,
  onCancel,
  onSave,
  onDelete,
  history,
  historyLoading,
}: {
  form: ItemFormState;
  locations: StorageLocation[];
  categorySuggestions: string[];
  saving: boolean;
  onChange: (form: ItemFormState) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  history: HistoryEntry[];
  historyLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={onCancel}>
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-aubergine mb-3">{form.id ? 'Edit item' : 'New item'}</h2>

        <div className="space-y-3">
          <input
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
            placeholder="Item name"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            autoFocus
          />
          <input
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
            placeholder="Category (e.g. Cleaners)"
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
            list="category-suggestions"
          />
          <datalist id="category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <select
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
            value={form.location_id}
            onChange={(e) => onChange({ ...form, location_id: e.target.value })}
          >
            <option value="">Unassigned</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              className="w-1/3 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-3 py-2.5 bg-cream/40"
              placeholder="Qty"
              value={form.current_qty}
              onChange={(e) => onChange({ ...form, current_qty: e.target.value })}
            />
            <input
              type="number"
              className="w-1/3 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-3 py-2.5 bg-cream/40"
              placeholder="Min"
              value={form.min_qty}
              onChange={(e) => onChange({ ...form, min_qty: e.target.value })}
            />
            <input
              className="w-1/3 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-3 py-2.5 bg-cream/40"
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => onChange({ ...form, unit: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <input
              className="w-1/2 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
              placeholder="Supplier"
              value={form.supplier}
              onChange={(e) => onChange({ ...form, supplier: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              className="w-1/2 border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
              placeholder="Price ($)"
              value={form.unit_cost}
              onChange={(e) => onChange({ ...form, unit_cost: e.target.value })}
            />
          </div>
          <input
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
            placeholder="Reorder link (URL)"
            value={form.reorder_link}
            onChange={(e) => onChange({ ...form, reorder_link: e.target.value })}
          />
          <input
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40"
            placeholder="Photo URL"
            value={form.photo_url}
            onChange={(e) => onChange({ ...form, photo_url: e.target.value })}
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-aubergine/30 text-aubergine"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-full bg-aubergine text-cream disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {form.reorder_link && (
          <a
            href={form.reorder_link}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center text-sm text-aubergine underline mt-3"
          >
            Open reorder link ↗
          </a>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-full text-center text-sm text-rust mt-3">
            Delete item
          </button>
        )}

        {form.id && (
          <div className="mt-5 pt-4 border-t border-gold-light/40">
            <p className="text-xs font-display italic text-aubergine/70 mb-2">History</p>
            {historyLoading ? (
              <p className="text-xs text-ink/40">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-ink/40">No changes recorded yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-ink/60">
                    <span className="text-ink/40">
                      {new Date(h.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>{' '}
                    — {describeHistoryEntry(h)}
                    {h.actor_name && <span className="text-ink/40"> · {h.actor_name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function describeHistoryEntry(h: HistoryEntry): string {
  if (h.action_type === 'created') return 'Item created';
  if (h.action_type === 'deleted') return 'Item deleted';
  if (h.action_type === 'quantity_changed') return `Quantity ${h.old_value ?? '?'} → ${h.new_value ?? '?'}`;
  if (h.field_name === 'name') return `Renamed "${h.old_value}" → "${h.new_value}"`;
  if (h.field_name) return `${h.field_name.replace('_', ' ')} changed`;
  return 'Updated';
}
