// components/InventoryClient.tsx
'use client';

import { useEffect, useState, useCallback, useRef, useId } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { categoryIcon } from '@/lib/icon-maps';
import { getItemIcon } from '@/lib/item-icons';
import { flattenLocationTree, locationPath, rootGroupName } from '@/lib/location-tree';
import { getLocationIcon } from '@/lib/location-icons';
import RestockPhotoPrompt from '@/components/RestockPhotoPrompt';
import LocationPhotoUpload from '@/components/LocationPhotoUpload';
import DuplicateItemWarning from '@/components/DuplicateItemWarning';
import { Camera } from 'lucide-react';

type StorageLocation = {
  id: string;
  name: string;
  parent_location_id: string | null;
  photo_url: string | null;
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
  expiration_date: string | null;
  qr_code: string | null;
  print_label: boolean;
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
  expiration_date: string;
  qr_code: string | null; // read-only, DB-generated — display only, never submitted
  print_label: boolean;
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
  expiration_date: '',
  qr_code: null,
  print_label: true,
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

// Matches the real Inventory Ops group + icons already in the Tools Hub
// (app/properties/[id]/tools/page.tsx) — same 4 tools, same slugs/icons,
// so this footer and the Tools Hub never drift apart from each other.
const INVENTORY_OPS_LINKS = [
  { slug: 'pantry-zones', icon: '🗺️', title: 'Pantry Zone Map' },
  { slug: 'borrowed-items', icon: '🔄', title: 'Borrowed & Lent' },
  { slug: 'duplicate-ingredients', icon: '🧩', title: 'Duplicate Ingredients' },
  { slug: 'needs-linking', icon: '🔗', title: 'Needs Linking' },
];

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
  const [categoryIconNames, setCategoryIconNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState | null>(null); // null = form closed
  const [saving, setSaving] = useState(false);
  const [photoPromptItem, setPhotoPromptItem] = useState<{ id: string; name: string } | null>(null);
  // Arrived here via a location QR scan — start filtered to that area, but
  // let the user clear it to see everything.
  const [locationFilter, setLocationFilter] = useState<string | null>(initialLocationFilter);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [photoUploadLocation, setPhotoUploadLocation] = useState<StorageLocation | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<
    { id: string; name: string; location_name: string | null; similarity: number }[] | null
  >(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [belowParOnly, setBelowParOnly] = useState(false);
  // 'rooms' = existing location drill-down, unchanged. 'all' = new flat
  // grid of every item regardless of room.
  const [viewMode, setViewMode] = useState<'rooms' | 'all'>('rooms');
  const categoryDatalistId = useId();
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
        .select(
          'id, name, location_id, current_qty, min_qty, unit, supplier, unit_cost, reorder_link, photo_url, category, expiration_date, qr_code, print_label'
        )
        .eq('property_id', propertyId)
        .order('name'),
      supabase
        .from('locations')
        .select('id, name, parent_location_id, photo_url')
        .eq('property_id', propertyId)
        .order('name'),
      // Fetch all available categories for autocomplete suggestions + icon fallback
      supabase
        .from('categories')
        .select('name, icon_name')
        .order('name'),
      user
        ? supabase
            .from('inventory_item_favorites')
            .select('inventory_item_id')
            .eq('property_id', propertyId)
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] as { inventory_item_id: string }[] }),
    ]);

    const loadErrors = [itemsRes.error, locationsRes.error, categoriesRes.error].filter(Boolean);
    if (loadErrors.length > 0) setError(loadErrors.map((e) => e!.message).join('; '));
    setItems(itemsRes.data ?? []);
    setLocations(locationsRes.data ?? []);
    setCategorySuggestions([...new Set((categoriesRes.data ?? []).map((c) => c.name))]);
    setCategoryIconNames(
      Object.fromEntries((categoriesRes.data ?? []).map((c) => [c.name, c.icon_name]).filter(([, icon]) => icon))
    );
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
        resilientDelete(supabase, 'inventory_items', { id }).catch((err) =>
          console.error(`Failed to delete item ${id} on unmount:`, err)
        );
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
      expiration_date: item.expiration_date ?? '',
      qr_code: item.qr_code,
      print_label: item.print_label,
    });
    setHistory([]);
    loadHistory(item.id);
  }

  async function saveForm() {
    if (!form || !form.name.trim()) return;

    // Duplicate check only applies to genuinely new items — editing an
    // existing row can't create a duplicate of itself.
    if (!form.id) {
      const { data: matches } = await supabase.rpc('find_similar_inventory_items', {
        p_property_id: propertyId,
        p_name: form.name.trim(),
      });
      if (matches && matches.length > 0) {
        setDuplicateMatches(matches);
        return;
      }
    }

    await performSave();
  }

  async function logDuplicateDecision(
    action: 'added_anyway' | 'updated_existing' | 'dismissed',
    match?: { id: string; name: string; similarity: number }
  ) {
    if (!form) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const top = match ?? duplicateMatches?.[0];
    await supabase.from('duplicate_warning_log').insert({
      property_id: propertyId,
      entered_name: form.name.trim(),
      matched_item_id: top?.id ?? null,
      matched_name: top?.name ?? null,
      similarity_score: top?.similarity ?? null,
      action,
      created_by: user?.id ?? null,
    });
  }

  async function handleAddAnyway() {
    await logDuplicateDecision('added_anyway');
    setDuplicateMatches(null);
    await performSave();
  }

  async function handleUpdateExisting(matchId: string) {
    const match = duplicateMatches?.find((m) => m.id === matchId);
    await logDuplicateDecision('updated_existing', match);
    setDuplicateMatches(null);

    const { data: existing } = await supabase
      .from('inventory_items')
      .select(
        'id, name, category, location_id, current_qty, min_qty, unit, supplier, unit_cost, reorder_link, photo_url, expiration_date, qr_code, print_label'
      )
      .eq('id', matchId)
      .single();
    if (existing) openEditForm(existing);
  }

  function handleDismissDuplicateWarning() {
    logDuplicateDecision('dismissed');
    setDuplicateMatches(null);
  }

  async function performSave() {
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
      expiration_date: form.expiration_date || null,
      print_label: form.print_label,
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
      // Supplying the id ourselves (rather than letting the DB default
      // generate one) means the local optimistic row and the real server
      // row share the same id from the start — no separate id-reconciling
      // re-fetch needed afterward, and no risk of that re-fetch matching
      // the wrong row when another item shares the same name.
      const newId = crypto.randomUUID();
      const result = await resilientInsert(supabase, 'inventory_items', { ...payload, id: newId });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        showToast('Failed to add item.', { variant: 'error' });
        return;
      }
      // qr_code is DB-trigger-generated on insert — unknown here until the
      // next reload; null is accurate, not a placeholder to fix later.
      setItems((prev) => [...prev, { ...payload, id: newId, qr_code: null }]);
      showToast(result.queued ? 'Added — will sync when back online.' : 'Item added.', {
        variant: 'success',
      });

      if (!result.queued && !payload.photo_url) {
        setPhotoPromptItem({ id: newId, name: payload.name });
      }
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
        setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
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
          setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
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

  const hasActiveFilter = searchQuery.trim() !== '' || categoryFilter !== null || belowParOnly;

  function matchesFilters(item: InventoryItem) {
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (belowParOnly && !(item.current_qty < item.min_qty)) return false;
    return true;
  }

  // Searching/filtering with no room selected searches across every room,
  // not just whatever the room grid happened to be showing.
  const displayItems = (locationFilter ? visibleItems : items).filter(matchesFilters);

  // All Items view ignores room selection entirely — it's the whole
  // inventory, still respecting the search/category/below-par overlay.
  const allItemsDisplay = items.filter(matchesFilters);

  const grouped = groupByLocation(visibleItems, locationName);

  if (loading) return <SkeletonList />;

  // Stat cards — real counts from the real fetched data, not placeholders.
  // Total Value is current_qty × unit_cost summed across items with both
  // populated; right now current_qty is 0 for literally every item in this
  // property (confirmed live — a pre-physical-count state, not a bug), so
  // this will read $0.00 until that count happens regardless of unit_cost.
  const totalItemsCount = items.length;
  const lowStockCount = items.filter((i) => i.current_qty < i.min_qty).length;
  const totalValue = items.reduce(
    (sum, i) => (i.unit_cost !== null ? sum + i.current_qty * i.unit_cost : sum),
    0
  );

  // Room summaries for the grid view — count + low-stock count per location.
  const roomSummaries = grouped.map(([location, locationItems]) => ({
    location,
    count: locationItems.length,
    lowCount: locationItems.filter((i) => i.current_qty < i.min_qty).length,
  }));

  // Group room cards under their real top-level room (Basement / Main Floor
  // / Upstairs) now that locations have a real hierarchy, instead of one
  // flat grid — "Unassigned" (items with no location at all) goes last.
  const roomsByGroup = new Map<string, typeof roomSummaries>();
  for (const summary of roomSummaries) {
    const loc = locations.find((l) => l.name === summary.location);
    const group = loc ? rootGroupName(locations, loc.id) : 'Unassigned';
    (roomsByGroup.get(group) ?? roomsByGroup.set(group, []).get(group)!).push(summary);
  }
  const roomGroupEntries = [...roomsByGroup.entries()].sort(([a], [b]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  function renderItemCard(item: InventoryItem, showLocation: boolean) {
    const low = item.current_qty < item.min_qty;
    const hasThumb = !!item.photo_url && isDirectImageUrl(item.photo_url) && !brokenPhotoIds.has(item.id);
    const isFav = favoriteIds.has(item.id);
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3.5 cursor-pointer hover:shadow-md hover:shadow-charcoal/10 transition-shadow"
        onClick={() => openEditForm(item)}
      >
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url!}
            alt=""
            className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gold-light/20"
            onError={() => setBrokenPhotoIds((prev) => new Set(prev).add(item.id))}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gold-light/20 shrink-0 flex items-center justify-center">
            {(() => {
              const Icon = getItemIcon(item.name, item.category, categoryIconNames[item.category ?? '']);
              return <Icon className="w-6 h-6 text-gold-dark" strokeWidth={1.75} />;
            })()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-charcoal truncate">{item.name}</p>
          <p className="text-xs text-charcoal/50 truncate mt-0.5">
            {[
              item.category ? `${categoryIcon(item.category)} ${item.category}` : null,
              showLocation ? locationName(item.location_id) : item.supplier,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-1.5">
            {low ? (
              <span className="text-xs font-medium text-rust bg-rust/10 px-2.5 py-1 rounded-full">
                {item.current_qty} / {item.min_qty} {item.unit} — low
              </span>
            ) : (
              <span className="text-xs text-charcoal/40">
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
  }

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center text-xs text-charcoal/40 overflow-hidden transition-all"
          style={{ height: refreshing ? 32 : pullDistance }}
        >
          {refreshing ? 'Refreshing…' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-charcoal">Inventory</h1>
        <div className="flex gap-2">
          <a
            href={`/properties/${propertyId}/scan`}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-cream border border-charcoal/30 text-charcoal text-lg"
            aria-label="Scan a label"
          >
            📷
          </a>
          <a
            href={`/properties/${propertyId}/print-labels`}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-cream border border-charcoal/30 text-charcoal text-lg"
            aria-label="Print item labels"
          >
            🏷️
          </a>
          <button
            onClick={openNewItemForm}
            className="text-sm font-medium bg-charcoal text-cream px-4 py-2 rounded-full"
          >
            + Add item
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl p-3 bg-white border border-gold-light/40 text-center">
          <div className="text-xl font-display text-charcoal">{totalItemsCount}</div>
          <div className="text-[11px] text-charcoal/50">Total Items</div>
        </div>
        <div className="rounded-2xl p-3 bg-white border border-gold-light/40 text-center">
          <div className={`text-xl font-display ${lowStockCount > 0 ? 'text-rust' : 'text-charcoal'}`}>
            {lowStockCount}
          </div>
          <div className="text-[11px] text-charcoal/50">Low Stock</div>
        </div>
        <div className="rounded-2xl p-3 bg-white border border-gold-light/40 text-center">
          <div className="text-xl font-display text-charcoal">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-charcoal/50">Total Value</div>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-gold-light/60 bg-white p-0.5 text-sm mb-4">
        <button
          onClick={() => setViewMode('rooms')}
          className={`rounded-full px-4 py-1.5 ${viewMode === 'rooms' ? 'bg-gold-dark text-white' : 'text-charcoal/60'}`}
        >
          Browse by Room
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`rounded-full px-4 py-1.5 ${viewMode === 'all' ? 'bg-gold-dark text-white' : 'text-charcoal/60'}`}
        >
          All Items
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items…"
          className="flex-1 min-w-[140px] border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-white text-sm"
        />
        <select
          value={categoryFilter ?? ''}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
          className="border border-gold-light/60 rounded-full px-3 py-2 bg-white text-sm"
        >
          <option value="">All categories</option>
          {categorySuggestions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setBelowParOnly((v) => !v)}
          className={`text-sm px-4 py-2 rounded-full border shrink-0 ${
            belowParOnly ? 'bg-rust text-white border-rust' : 'border-gold-light/60 text-charcoal'
          }`}
        >
          Below par only
        </button>
      </div>

      {viewMode === 'all' ? (
        // ---- All Items: flat grid of the whole inventory, ignoring room selection ----
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
          {allItemsDisplay.map((item) => renderItemCard(item, true))}
        </div>
      ) : !locationFilter && !hasActiveFilter ? (
        // ---- Room grid: pick a room to see what's inside, grouped by real top-level room ----
        <div className="space-y-5">
          {favoriteIds.size > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <button
                onClick={() => setLocationFilter(FAVORITES)}
                className="text-left bg-gold-light/25 rounded-2xl shadow-sm shadow-charcoal/5 p-4 hover:bg-gold-light/40 transition-colors"
              >
                <p className="font-display text-lg text-charcoal truncate">⭐ Favorites</p>
                <p className="text-xs text-charcoal/50 mt-1">
                  {favoriteIds.size} item{favoriteIds.size === 1 ? '' : 's'}
                </p>
              </button>
            </div>
          )}
          {roomGroupEntries.map(([groupName, summaries]) => (
            <div key={groupName}>
              {roomGroupEntries.length > 1 && (
                <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">{groupName}</h2>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {summaries.map(({ location, count, lowCount }) => {
                  const loc = locations.find((l) => l.name === location);
                  const Icon = getLocationIcon(location);
                  return (
                    <button
                      key={location}
                      onClick={() => setLocationFilter(loc ? loc.id : UNASSIGNED)}
                      className="relative text-left bg-white rounded-2xl shadow-sm shadow-charcoal/5 overflow-hidden hover:bg-gold-light/15 transition-colors"
                    >
                      {loc?.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loc.photo_url} alt="" className="w-full h-20 object-cover" />
                      )}
                      <div className="p-4">
                        <Icon className="w-5 h-5 text-gold-dark mb-1.5" strokeWidth={1.75} />
                        <p className="font-display text-lg text-charcoal truncate">{location}</p>
                        <p className="text-xs text-charcoal/50 mt-1">
                          {count} item{count === 1 ? '' : 's'}
                        </p>
                        {lowCount > 0 && (
                          <span className="inline-block mt-2 text-xs font-medium text-rust bg-rust/10 px-2 py-0.5 rounded-full">
                            {lowCount} low
                          </span>
                        )}
                      </div>
                      {loc && canManage(role) && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoUploadLocation(loc);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-charcoal/60 hover:text-charcoal"
                          role="button"
                          aria-label={`Add photo of ${location}`}
                        >
                          <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowNewRoom(true)}
            className="text-left border-2 border-dashed border-gold-light rounded-2xl p-4 text-charcoal/60 hover:bg-gold-light/10 transition-colors w-full md:w-auto"
          >
            <p className="font-display text-lg">+ Add room</p>
          </button>
        </div>
      ) : !locationFilter && hasActiveFilter ? (
        // ---- Search/filter results across every room ----
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
          {displayItems.map((item) => renderItemCard(item, true))}
        </div>
      ) : (
        // ---- Single room's item list ----
        <>
          <button
            onClick={() => setLocationFilter(null)}
            className="flex items-center gap-1 text-sm text-charcoal mb-3 font-medium"
          >
            ← Rooms
          </button>
          <h2 className="font-display text-lg text-charcoal mb-2">
            {locationFilter === FAVORITES ? '⭐ Favorites' : locationPath(locations, locationFilter)}
          </h2>
          <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
            {displayItems.map((item) => renderItemCard(item, false))}
          </div>
        </>
      )}

      {(viewMode === 'all' ? allItemsDisplay : displayItems).length === 0 && (
        <p className="text-sm text-charcoal/40 text-center mt-8">
          {hasActiveFilter
            ? 'No items match your search.'
            : locationFilter === FAVORITES
            ? 'No favorites yet — tap the star on any item.'
            : locationFilter
            ? 'No items in this area yet.'
            : 'No items yet. Tap "Add item" to get started.'}
        </p>
      )}

      <div className="mt-8 pt-4 border-t border-gold-light/30">
        <h2 className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-2">Inventory Ops Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INVENTORY_OPS_LINKS.map((tool) => (
            <a
              key={tool.slug}
              href={`/properties/${propertyId}/tools/${tool.slug}`}
              className="flex items-center gap-1.5 bg-white rounded-xl border border-gold-light/40 px-3 py-2 text-xs text-charcoal hover:border-gold transition-colors"
            >
              <span aria-hidden="true">{tool.icon}</span>
              <span className="truncate">{tool.title}</span>
            </a>
          ))}
        </div>
      </div>

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
          categoryDatalistId={categoryDatalistId}
          propertyId={propertyId}
        />
      )}

      {photoPromptItem && (
        <RestockPhotoPrompt
          itemId={photoPromptItem.id}
          itemName={photoPromptItem.name}
          propertyId={propertyId}
          onDone={() => setPhotoPromptItem(null)}
        />
      )}

      {duplicateMatches && form && (
        <DuplicateItemWarning
          enteredName={form.name.trim()}
          matches={duplicateMatches}
          onAddAnyway={handleAddAnyway}
          onUpdateExisting={handleUpdateExisting}
          onDismiss={handleDismissDuplicateWarning}
        />
      )}

      {photoUploadLocation && (
        <LocationPhotoUpload
          locationId={photoUploadLocation.id}
          locationName={photoUploadLocation.name}
          onDone={(photoUrl) => {
            if (photoUrl) {
              setLocations((prev) =>
                prev.map((l) => (l.id === photoUploadLocation.id ? { ...l, photo_url: photoUrl } : l))
              );
            }
            setPhotoUploadLocation(null);
          }}
        />
      )}

      {showNewRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setShowNewRoom(false)}>
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-charcoal mb-3">New room</h2>
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
                className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
              >
                Cancel
              </button>
              <button
                onClick={saveNewRoom}
                disabled={savingRoom || !newRoomName.trim()}
                className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-charcoal/60 mb-1">{children}</label>;
}

const fieldClass =
  'w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 bg-cream/40';

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
  categoryDatalistId,
  propertyId,
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
  categoryDatalistId: string;
  propertyId: string;
}) {
  const restockInterval = restockIntervalDays(history);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={onCancel}>
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-charcoal mb-3">{form.id ? 'Edit item' : 'New item'}</h2>

        <div className="space-y-4">
          <div>
            <FieldLabel>Item Name</FieldLabel>
            <input
              className={fieldClass}
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <input
              className={fieldClass}
              placeholder="e.g. Cleaners"
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              list={categoryDatalistId}
            />
            <datalist id={categoryDatalistId}>
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
          <FieldLabel>Location</FieldLabel>
          <select
            className={fieldClass}
            value={form.location_id}
            onChange={(e) => onChange({ ...form, location_id: e.target.value })}
          >
            <option value="">Unassigned</option>
            {flattenLocationTree(locations).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {'  '.repeat(loc.depth)}
                {loc.depth > 0 ? '↳ ' : ''}
                {loc.name}
              </option>
            ))}
          </select>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">Quantity</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <FieldLabel>On Hand</FieldLabel>
                <input
                  type="number"
                  className={fieldClass}
                  value={form.current_qty}
                  onChange={(e) => onChange({ ...form, current_qty: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Minimum / Par Level</FieldLabel>
                <input
                  type="number"
                  className={fieldClass}
                  value={form.min_qty}
                  onChange={(e) => onChange({ ...form, min_qty: e.target.value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Unit</FieldLabel>
              <input
                className={fieldClass}
                value={form.unit}
                onChange={(e) => onChange({ ...form, unit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Supplier</FieldLabel>
              <input
                className={fieldClass}
                value={form.supplier}
                onChange={(e) => onChange({ ...form, supplier: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Price ($)</FieldLabel>
              <input
                type="number"
                step="0.01"
                className={fieldClass}
                value={form.unit_cost}
                onChange={(e) => onChange({ ...form, unit_cost: e.target.value })}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Reorder Link</FieldLabel>
            <input
              className={fieldClass}
              placeholder="URL"
              value={form.reorder_link}
              onChange={(e) => onChange({ ...form, reorder_link: e.target.value })}
            />
          </div>

          <div>
            <FieldLabel>Photo URL</FieldLabel>
            <input
              className={fieldClass}
              value={form.photo_url}
              onChange={(e) => onChange({ ...form, photo_url: e.target.value })}
            />
          </div>

          <div>
            <FieldLabel>Barcode</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-charcoal/60 font-mono border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 truncate">
                {form.qr_code ?? 'Generated on save'}
              </span>
              {form.id && (
                <a
                  href={`/properties/${propertyId}/scan`}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-cream border border-charcoal/30 text-charcoal text-lg"
                  aria-label="Scan"
                >
                  📷
                </a>
              )}
            </div>
          </div>

          <div>
            <FieldLabel>Expiration Date</FieldLabel>
            <input
              type="date"
              className={fieldClass}
              value={form.expiration_date}
              onChange={(e) => onChange({ ...form, expiration_date: e.target.value })}
            />
          </div>

          <label className="flex items-center justify-between bg-cream/40 border border-gold-light/60 rounded-2xl px-4 py-2.5 cursor-pointer">
            <span className="text-sm text-charcoal">Print Label</span>
            <input
              type="checkbox"
              checked={form.print_label}
              onChange={(e) => onChange({ ...form, print_label: e.target.checked })}
              className="h-5 w-5 accent-gold-dark rounded"
            />
          </label>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {form.reorder_link && (
          <a
            href={form.reorder_link}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center text-sm text-charcoal underline mt-3"
          >
            Open reorder link ↗
          </a>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-full text-center text-sm text-rust mt-3">
            Delete item
          </button>
        )}

        {form.id && restockInterval !== null && (
          <div className="mt-5 pt-4 border-t border-gold-light/40">
            <p className="text-xs text-charcoal/60 bg-gold-light/15 rounded-lg px-3 py-2 mb-3">
              Usually restocked every ~{restockInterval} day{restockInterval === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {form.id && (
          <div className="mt-5 pt-4 border-t border-gold-light/40">
            <p className="text-xs font-display italic text-charcoal/70 mb-2">History</p>
            {historyLoading ? (
              <p className="text-xs text-charcoal/40">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-charcoal/40">No changes recorded yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-charcoal/60">
                    <span className="text-charcoal/40">
                      {new Date(h.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>{' '}
                    — {describeHistoryEntry(h)}
                    {h.actor_name && <span className="text-charcoal/40"> · {h.actor_name}</span>}
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

// Informational only — averages the gaps between logged quantity changes.
// Needs at least 3 such events (2 real gaps) to say anything; guessing off
// 1-2 data points would just be noise, not a forecast.
function restockIntervalDays(history: HistoryEntry[]): number | null {
  const changeDates = history
    .filter((h) => h.action_type === 'quantity_changed')
    .map((h) => new Date(h.created_at).getTime())
    .sort((a, b) => a - b);
  if (changeDates.length < 3) return null;

  const gapsDays: number[] = [];
  for (let i = 1; i < changeDates.length; i++) {
    gapsDays.push((changeDates[i] - changeDates[i - 1]) / (1000 * 60 * 60 * 24));
  }
  const avg = gapsDays.reduce((sum, g) => sum + g, 0) / gapsDays.length;
  return Math.round(avg);
}

function describeHistoryEntry(h: HistoryEntry): string {
  if (h.action_type === 'created') return 'Item created';
  if (h.action_type === 'deleted') return 'Item deleted';
  if (h.action_type === 'quantity_changed') return `Quantity ${h.old_value ?? '?'} → ${h.new_value ?? '?'}`;
  if (h.field_name === 'name') return `Renamed "${h.old_value}" → "${h.new_value}"`;
  if (h.field_name) return `${h.field_name.replace('_', ' ')} changed`;
  return 'Updated';
}
