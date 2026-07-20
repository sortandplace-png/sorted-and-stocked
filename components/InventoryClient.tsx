// components/InventoryClient.tsx
'use client';

import { useEffect, useState, useCallback, useMemo, useRef, useId } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientUpdateWithVersionCheck, resilientDelete } from '@/lib/resilient-write';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { categoryIcon } from '@/lib/icon-maps';
import { getItemIcon } from '@/lib/item-icons';
import { flattenLocationTree, locationPath, rootGroupName, getDescendantIds } from '@/lib/location-tree';
import { getLocationIcon } from '@/lib/location-icons';
import RestockPhotoPrompt from '@/components/RestockPhotoPrompt';
import LocationPhotoUpload from '@/components/LocationPhotoUpload';
import DuplicateItemWarning from '@/components/DuplicateItemWarning';
import InventoryBracha from '@/components/InventoryBracha';
import ReorderSourcesEditor from '@/components/ReorderSourcesEditor';
import OrderLink from '@/components/OrderLink';
import type { ReorderSource } from '@/lib/reorder-sources';
import { FilterPill, FilterPillRow } from '@/components/recipes/FilterPill';
import { isFoodCategory } from '@/lib/foodCategories';
import { compressImageToBlob } from '@/lib/compress-image';
import { useSessionPersistedState } from '@/lib/use-session-persisted-state';
import CameraCapture from '@/components/CameraCapture';
import { Camera, AlertTriangle, Clock, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

type StorageLocation = {
  id: string;
  name: string;
  parent_location_id: string | null;
  photo_url: string | null;
};

// needs_review is deliberately the loudest of the three -- it's the one
// that needs a human decision, so it shouldn't blend in next to a cleared
// item the way a quiet default state would. Deliberately keyed on only the
// 3 food-relevant statuses (not InventoryItem['pesach_status'] directly) --
// 'not_applicable' (non-food categories) has no entry here on purpose, so
// it's naturally excluded from both the per-item badge and the filter row
// below rather than needing a separate check at every render site.
const PESACH_STATUS_INFO: Record<
  'kosher_for_pesach' | 'not_kosher_for_pesach' | 'needs_review',
  { label: string; icon: typeof CheckCircle2; badgeClass: string }
> = {
  kosher_for_pesach: { label: 'Kosher for Pesach', icon: CheckCircle2, badgeClass: 'bg-sage/15 text-sage' },
  not_kosher_for_pesach: { label: 'Not for Pesach', icon: XCircle, badgeClass: 'bg-rust/15 text-rust' },
  needs_review: { label: 'Needs Review', icon: HelpCircle, badgeClass: 'bg-denim text-white font-semibold' },
};

type InventoryItem = {
  id: string;
  name: string;
  name_es: string | null;
  category: string | null;
  location_id: string | null;
  current_qty: number;
  min_qty: number;
  unit: string;
  // Set only for items bought by the case/pack -- null means the quantity
  // stepper's long-press bulk-add stays off for this item. No existing
  // data populates this; it's set per-item through the edit form.
  case_size: number | null;
  supplier: string | null;
  unit_cost: number | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
  photo_url: string | null;
  expiration_date: string | null;
  opened_date: string | null;
  qr_code: string | null;
  print_label: boolean;
  pesach_status: 'kosher_for_pesach' | 'not_kosher_for_pesach' | 'needs_review' | 'not_applicable';
  last_counted_at: string | null;
  updated_at: string;
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
  name_es: string;
  category: string;
  location_id: string;
  current_qty: string;
  min_qty: string;
  unit: string;
  case_size: string;
  supplier: string;
  unit_cost: string;
  // Create-only. There's no inventory_item_id to attach a reorder_sources
  // row to before the item exists, so this is never shown or read once
  // form.id is set -- ReorderSourcesEditor takes over entirely at that
  // point, same as History/Bracha's "only after creation" pattern. Kept
  // here (rather than dropped, as an earlier pass this session did) so
  // creating an item and giving it a reorder link stays the one-motion
  // action it's always been -- see create_inventory_item_with_source.
  reorder_link: string;
  photo_url: string;
  expiration_date: string;
  opened_date: string;
  qr_code: string | null; // read-only, DB-generated — display only, never submitted
  print_label: boolean;
  // Loaded value at edit-open time, for the optimistic-lock check on save —
  // never rendered as an editable field.
  updated_at: string | null;
};

const EMPTY_FORM: ItemFormState = {
  id: null,
  name: '',
  name_es: '',
  category: '',
  location_id: '',
  current_qty: '0',
  min_qty: '0',
  unit: 'pcs',
  case_size: '',
  supplier: '',
  unit_cost: '',
  reorder_link: '',
  photo_url: '',
  expiration_date: '',
  opened_date: '',
  qr_code: null,
  print_label: true,
  updated_at: null,
};

// create_inventory_item_with_source needs a retailer name alongside the
// URL (reorder_sources.retailer_name is NOT NULL) -- the old create-item
// field was just a bare URL, so one is guessed from the hostname rather
// than adding a second input and changing what the form looks like. Best
// effort only: if this comes back empty (unparseable input), the RPC's
// own COALESCE falls back to a generic "Other" rather than failing the
// whole save. Renaming to the real retailer is one tap away afterward via
// ReorderSourcesEditor once the item exists.
function deriveRetailerName(rawUrl: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const hostname = new URL(withScheme).hostname.replace(/^www\./, '');
    const base = hostname.split('.')[0];
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
  } catch {
    return '';
  }
}

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
// Matches the Recipes page's own expiring-soon default window
// (RecipesGridView's expiringWindow, get_expiring_soon_recipes RPC).
const EXPIRING_SOON_DAYS = 4;

function isExpiringSoon(expirationDate: string | null): boolean {
  if (!expirationDate) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_DAYS);
  return new Date(expirationDate) <= cutoff;
}

// Distinct from isExpiringSoon (4-day window, feeds the existing filter
// pill) -- the "Expiring Soon" stat card is a real 30-day window and
// deliberately excludes already-past dates (those are expired, a different
// concern, not "coming up soon"). Verified against real live data: exactly
// 73 Main House items match this window as of today.
// Gating on last_counted_at (excluding uncounted items) was a deliberate
// earlier call to avoid flagging ~everything as false-positive low --
// reversed per Racquel, July 19: verified against the database that by its
// own definition (current_qty <= min_qty) 1,128 of 1,129 Main items are
// genuinely low, virtually none ever physically counted, and this stat
// should say so rather than hide it -- "Low Stock will effectively list
// the entire house" until real counts happen is the accepted, known
// consequence, not a bug to work around. get_low_stock_items() (the RPC
// behind the Dashboard's own Low Stock tile) never had this gate to begin
// with -- current_qty < min_qty only -- so this brings the Inventory
// page's own stat back in line with what the Dashboard already showed,
// not a new, untested definition. Matches Racquel's stated comparison
// exactly: current_qty <= min_qty, not the RPC's strict <.
function isLowStock(item: Pick<InventoryItem, 'current_qty' | 'min_qty'>): boolean {
  return item.current_qty <= item.min_qty;
}

function isExpiringWithin30Days(expirationDate: string | null): boolean {
  if (!expirationDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);
  const expDate = new Date(expirationDate);
  return expDate >= today && expDate <= cutoff;
}

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
  initialOpenNew = false,
  initialItemId = null,
}: {
  propertyId: string;
  initialLocationFilter?: string | null;
  initialOpenNew?: boolean;
  initialItemId?: string | null;
}) {
  const locale = useLocale();
  const displayName = (item: { name: string; name_es: string | null }) =>
    locale === 'es' && item.name_es ? item.name_es : item.name;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [categoryIconNames, setCategoryIconNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState | null>(null); // null = form closed
  const [saving, setSaving] = useState(false);
  // Held here rather than in ItemFormSheet's own state because the
  // duplicate-item warning flow (handleAddAnyway) can re-invoke performSave
  // after the sheet's initial onSave call, and needs the same pending file.
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoRemoved, setPendingPhotoRemoved] = useState(false);
  const [photoPromptItem, setPhotoPromptItem] = useState<{ id: string; name: string } | null>(null);
  // Arrived here via a location QR scan — start filtered to that area, but
  // let the user clear it to see everything.
  const [locationFilter, setLocationFilter] = useState<string | null>(initialLocationFilter);
  // Room grid sort/filter -- purely a display-order concern, doesn't touch
  // which rooms exist or how they're grouped by floor.
  const [lowStockFirst, setLowStockFirst] = useState(false);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  // Pesach Mode -- same feature_flags pattern as auto-restock (moved to its
  // own Shopping Rules settings page). When on,
  // surfaces pesach_status on item cards/filters here, defaults the
  // Recipes page's Occasion filter to Pesach, and flags (not silently
  // includes) uncleared items on the shopping list.
  const [pesachModeEnabled, setPesachModeEnabled] = useState(false);
  const [savingPesachMode, setSavingPesachMode] = useState(false);
  // Content filters below use sessionStorage-backed state (not plain
  // useState) so a phone lock/backgrounding mid-walkthrough doesn't lose
  // them -- see lib/use-session-persisted-state.ts. Room-navigation state
  // (locationFilter, floorFilter, lowStockFirst above) deliberately stays
  // on plain useState -- locationFilter already has its own correct
  // URL-driven initialization (QR scans, search deep-links), and mixing
  // that with session-restored state risks the two fighting each other.
  const [pesachStatusFilter, setPesachStatusFilter] = useSessionPersistedState<string | null>(
    'inventory-filter-pesachStatus',
    null
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [photoUploadLocation, setPhotoUploadLocation] = useState<StorageLocation | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<
    {
      id: string;
      name: string;
      location_name: string | null;
      similarity: number;
      opened_date: string | null;
      current_qty: number;
    }[] | null
  >(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useSessionPersistedState('inventory-filter-search', '');
  // search_inventory_items() results for the current query -- synonym-aware
  // (e.g. "garbage bags" finds "Trash Bags"), which a plain client-side
  // substring check on item.name can never do. `query` is stored alongside
  // the ids so a stale in-flight result for a since-changed query string
  // can't get applied to the wrong search -- matchesFilters() below falls
  // back to a plain substring match on the (now-complete) local items list
  // while the debounced RPC call is still in flight, so results don't flash
  // to empty on every keystroke.
  const [searchResults, setSearchResults] = useState<{ query: string; ids: Set<string> } | null>(null);
  const [categoryFilter, setCategoryFilter] = useSessionPersistedState<string | null>(
    'inventory-filter-category',
    null
  );
  const [belowParOnly, setBelowParOnly] = useSessionPersistedState('inventory-filter-belowPar', false);
  const [expiringSoonOnly, setExpiringSoonOnly] = useSessionPersistedState('inventory-filter-expiringSoon', false);
  // Separate from expiringSoonOnly (4-day filter pill) -- this is the new
  // stat card's own 30-day filter.
  const [expiringSoon30Only, setExpiringSoon30Only] = useSessionPersistedState(
    'inventory-filter-expiringSoon30',
    false
  );
  // 'rooms' = existing location drill-down, unchanged. 'all' = new flat
  // grid of every item regardless of room.
  const [viewMode, setViewMode] = useState<'rooms' | 'all'>('rooms');
  // Collapsible A-Z letter sections for All Items -- same pattern as the
  // Recipes grid and the Tools hub. Only relevant to 'all' (the longest
  // list, 698 items); room drill-down keeps its own real hierarchy.
  const [collapsedLetters, setCollapsedLetters] = useState<Set<string>>(new Set());
  const categoryDatalistId = useId();
  // Tracks item IDs whose photo failed to actually load (dead link, 404,
  // etc.) — isDirectImageUrl only checks the URL *shape*, not whether the
  // image is reachable, so a broken link would otherwise render as the
  // browser's broken-image icon instead of falling back to the category icon.
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());
  // Which item's stepper is currently showing its long-press bulk-add
  // chips (+half-case/+full-case) -- at most one at a time, dismissed on
  // any tap elsewhere or once a chip is used.
  const [bulkAddItemId, setBulkAddItemId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true the moment a long-press actually opens the bulk-add chips, so
  // the mouseup/touchend that follows a real long-press doesn't also fire
  // as an ordinary tap (which would both open the chips AND add +1).
  const longPressFiredRef = useRef(false);

  function startLongPress(item: InventoryItem) {
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (item.case_size) {
        longPressFiredRef.current = true;
        setBulkAddItemId(item.id);
      }
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

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

    // Real bug found and fixed, not assumed: a plain unpaginated .select()
    // here silently truncated at PostgREST's default 1000-row cap the
    // moment this property's inventory crossed that count (confirmed live:
    // 1048 real rows, only 1000 ever loaded) -- not just a wrong "Total
    // Items" number, every downstream view on this page (room browsing,
    // All Items, search, low-stock/expiring pills) derives from this same
    // array, so the last 48+ items were invisible everywhere, not just
    // miscounted. .range() pages through in batches of 1000 until a page
    // comes back short, same fix pattern as the dashboard inventory count.
    async function fetchAllInventoryItems() {
      const pageSize = 1000;
      let all: any[] = [];
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select(
            'id, name, name_es, location_id, current_qty, min_qty, unit, case_size, supplier, unit_cost, reorder_link, reorder_sources(id, retailer_name, url, is_preferred), photo_url, category, expiration_date, opened_date, qr_code, print_label, pesach_status, last_counted_at, updated_at'
          )
          .eq('property_id', propertyId)
          .order('name')
          .range(offset, offset + pageSize - 1);
        if (error) return { data: null, error };
        all = all.concat(data ?? []);
        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }
      return { data: all, error: null };
    }

    const [itemsRes, locationsRes, categoriesRes, favoritesRes, propertyRes] = await Promise.all([
      fetchAllInventoryItems(),
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
      // feature_flags.pesach_mode -- same jsonb pattern already used for
      // auto_restock (now on its own Shopping Rules settings page).
      supabase.from('properties').select('feature_flags').eq('id', propertyId).single(),
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
    const flags = (propertyRes.data?.feature_flags ?? {}) as Record<string, boolean>;
    setPesachModeEnabled(!!flags.pesach_mode);
    setLoading(false);
  }, [propertyId, supabase]);

  async function togglePesachMode() {
    setSavingPesachMode(true);
    const next = !pesachModeEnabled;
    // Same read-then-merge as auto-restock -- never blind-overwrite the
    // shared feature_flags column.
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (current?.feature_flags ?? {}) as Record<string, boolean>;
    const { error: flagError } = await supabase
      .from('properties')
      .update({ feature_flags: { ...flags, pesach_mode: next } })
      .eq('id', propertyId);
    setSavingPesachMode(false);
    if (flagError) {
      showToast('Failed to update Pesach Mode.', { variant: 'error' });
      return;
    }
    setPesachModeEnabled(next);
    if (!next) setPesachStatusFilter(null);
    showToast(next ? 'Pesach Mode enabled.' : 'Pesach Mode disabled.', { variant: 'success' });
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Synonym-aware search (search_inventory_items(), migration -- replaces
  // the old plain substring check on item.name, which had zero results for
  // "garbage bags" against an item named "Trash Bags"). Debounced so every
  // keystroke doesn't fire its own request; `cancelled` guards against a
  // slower, older request resolving after a newer one and clobbering it.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_inventory_items', {
        p_property_id: propertyId,
        p_query: q,
      });
      if (!cancelled && !error) {
        setSearchResults({ query: q, ids: new Set((data ?? []).map((r: { id: string }) => r.id)) });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery, propertyId, supabase]);

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

  // The card-level replacement for "open the edit form just to bump a
  // number" -- current_qty only, floored at 0. Plain resilientUpdate
  // (not the version-checked save the full edit form uses) since a
  // stepper is meant for fast repeated taps, and last_counted_at/
  // low-stock-shopping-list/audit-history all follow for free from the
  // existing DB triggers on this table (trg_inventory_items_last_counted_at,
  // trg_inventory_low_stock, trg_log_inventory_item_change) -- nothing
  // else needs to happen client-side here.
  async function adjustQuantity(item: InventoryItem, delta: number) {
    const newQty = Math.max(0, item.current_qty + delta);
    if (newQty === item.current_qty) return;
    // last_counted_at is optimistically stamped here too, matching what
    // trg_inventory_items_last_counted_at does server-side on any real
    // qty change -- otherwise a "Not yet counted" badge would keep
    // showing until the next full reload despite the DB already being
    // correct, since the optimistic update above only touches current_qty.
    const previous = { current_qty: item.current_qty, last_counted_at: item.last_counted_at };
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, current_qty: newQty, last_counted_at: nowIso } : i))
    );
    const result = await resilientUpdate(supabase, 'inventory_items', { id: item.id }, { current_qty: newQty });
    if (!result.ok) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...previous } : i)));
      showToast('Failed to update quantity.', { variant: 'error' });
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

  // Best-effort attribution for the optimistic-lock conflict message.
  // inventory_item_history only logs a row for a handful of tracked fields
  // (name/category/location_id/min_qty/current_qty, see
  // log_inventory_item_change()), so a conflicting edit that only touched an
  // untracked field (photo, supplier, cost...) won't have a matching row.
  // Only trust the name if the most recent history row is recent enough to
  // plausibly be the conflicting edit itself, not some unrelated older one.
  async function getRecentEditorName(itemId: string): Promise<string | null> {
    const { data } = await supabase
      .from('inventory_item_history')
      .select('actor_name, created_at')
      .eq('inventory_item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.actor_name) return null;
    const ageMs = Date.now() - new Date(data.created_at).getTime();
    return ageMs < 5 * 60 * 1000 ? data.actor_name : null;
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
    // Respect whatever room/location is currently being viewed instead of
    // always defaulting to the first location in the list — but Favorites
    // is a pseudo-filter, not a real location, so it doesn't count here.
    const defaultLocationId =
      locationFilter && locationFilter !== FAVORITES ? locationFilter : locations[0]?.id ?? '';
    setForm({ ...EMPTY_FORM, location_id: defaultLocationId });
    setPendingPhotoFile(null);
    setPendingPhotoRemoved(false);
  }

  // Dashboard's Quick Capture "Add product" tile links here with ?new=1 so
  // the add-item sheet is one tap instead of landing on the list and
  // needing to find "Add Item" first. Gated on !loading (not just mount)
  // since openNewItemForm reads locations[0]?.id for the default room --
  // firing before that list loads would leave the new item unassigned.
  // openedFromQueryRef guards against re-opening if loading flips again
  // later (e.g. a pull-to-refresh) after the user has already closed it.
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (initialOpenNew && !loading && !openedFromQueryRef.current) {
      openedFromQueryRef.current = true;
      openNewItemForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenNew, loading]);

  // Arrived here via a search result or a Low Stock Alert click for one
  // specific item -- the room-level QR-scan filter above gets someone into
  // the right room, but still leaves them hunting a shelf's worth of items
  // for the one they actually came for. This opens that exact item's real
  // detail view (the same edit-form modal a manual tap on its card opens)
  // and sets the room filter to match, so closing the modal lands on a
  // sensibly-scoped list rather than the full unfiltered inventory.
  const openedItemFromQueryRef = useRef(false);
  useEffect(() => {
    if (initialItemId && !loading && !openedItemFromQueryRef.current) {
      const target = items.find((i) => i.id === initialItemId);
      if (target) {
        openedItemFromQueryRef.current = true;
        setLocationFilter(target.location_id ?? null);
        openEditForm(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItemId, loading, items]);

  function openEditForm(item: InventoryItem) {
    setPendingPhotoFile(null);
    setPendingPhotoRemoved(false);
    setForm({
      id: item.id,
      name: item.name,
      name_es: item.name_es ?? '',
      category: item.category ?? '',
      location_id: item.location_id ?? '',
      current_qty: String(item.current_qty),
      min_qty: String(item.min_qty),
      case_size: item.case_size !== null ? String(item.case_size) : '',
      unit: item.unit,
      supplier: item.supplier ?? '',
      unit_cost: item.unit_cost !== null ? String(item.unit_cost) : '',
      // Never shown/read once editing an existing item -- see the
      // ItemFormState field comment.
      reorder_link: '',
      photo_url: item.photo_url ?? '',
      expiration_date: item.expiration_date ?? '',
      opened_date: item.opened_date ?? '',
      qr_code: item.qr_code,
      print_label: item.print_label,
      updated_at: item.updated_at,
    });
    setHistory([]);
    loadHistory(item.id);
  }

  async function saveForm() {
    if (!form || !form.name.trim()) return;
    if (!form.name_es.trim()) {
      showToast('Spanish name is required.', { variant: 'error' });
      return;
    }

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
        'id, name, name_es, category, location_id, current_qty, min_qty, unit, case_size, supplier, unit_cost, reorder_link, reorder_sources(id, retailer_name, url, is_preferred), photo_url, expiration_date, opened_date, qr_code, print_label, pesach_status, last_counted_at, updated_at'
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

    // Computed up front (rather than only on insert, as before) so the
    // photo upload path below has a stable id to key its storage path on
    // whether this is a new item or an edit.
    const id = form.id ?? crypto.randomUUID();

    let photoUrl = form.photo_url.trim() || null;
    let photoUploadError: string | null = null;
    if (pendingPhotoFile) {
      const path = `${propertyId}/${id}-${Date.now()}.jpg`;
      try {
        const compressed = await compressImageToBlob(pendingPhotoFile);
        const { error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (!uploadError) {
          const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
          photoUrl = data.publicUrl;
        } else {
          photoUploadError = uploadError.message;
        }
      } catch (err) {
        photoUploadError = err instanceof Error ? err.message : 'Unknown error';
      }
    } else if (pendingPhotoRemoved) {
      photoUrl = null;
    }

    const payload = {
      property_id: propertyId,
      name: form.name.trim(),
      name_es: form.name_es.trim(),
      category: form.category.trim() || null,
      location_id: form.location_id || null,
      current_qty: Number(form.current_qty) || 0,
      min_qty: Number(form.min_qty) || 0,
      unit: form.unit.trim() || 'pcs',
      case_size: form.case_size.trim() ? Number(form.case_size) : null,
      supplier: form.supplier.trim() || null,
      unit_cost: form.unit_cost.trim() ? Number(form.unit_cost) : null,
      photo_url: photoUrl,
      expiration_date: form.expiration_date || null,
      opened_date: form.opened_date || null,
      print_label: form.print_label,
    };

    if (form.id) {
      // Optimistic locking: only apply if updated_at still matches what this
      // form loaded. If someone else saved in between, zero rows match and
      // this comes back as a conflict instead of silently clobbering their
      // change. form.updated_at should always be set by openEditForm; the
      // fallback to a plain update only guards against that invariant ever
      // breaking, not a real expected path.
      const result = form.updated_at
        ? await resilientUpdateWithVersionCheck(supabase, 'inventory_items', id, form.updated_at, payload)
        : await resilientUpdate(supabase, 'inventory_items', { id }, payload);
      setSaving(false);
      if (!result.ok) {
        if ('conflict' in result && result.conflict) {
          const recentEditorName = await getRecentEditorName(id);
          showToast(
            recentEditorName
              ? `This item was just updated by ${recentEditorName} — reload to see their change before saving yours.`
              : "This item was just updated by someone else — reload to see their change before saving yours.",
            { variant: 'error', durationMs: 10000 }
          );
          return;
        }
        setError('error' in result ? result.error : 'Failed to save item.');
        showToast('Failed to save item.', { variant: 'error' });
        return;
      }
      const newUpdatedAt = 'newUpdatedAt' in result ? result.newUpdatedAt : undefined;
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...payload, id, updated_at: newUpdatedAt ?? i.updated_at } : i))
      );
      if (photoUploadError) {
        showToast(`Item saved, but the photo failed to upload: ${photoUploadError}`, {
          variant: 'error',
          durationMs: 8000,
        });
      } else {
        showToast(result.queued ? 'Saved — will sync when back online.' : 'Item saved.', {
          variant: 'success',
        });
      }
    } else {
      const reorderUrl = form.reorder_link.trim();
      const reorderRetailer = reorderUrl ? deriveRetailerName(reorderUrl) : '';
      const optimisticSources = reorderUrl
        ? [{ id: crypto.randomUUID(), retailer_name: reorderRetailer || 'Other', url: reorderUrl, is_preferred: true }]
        : null;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

      if (offline) {
        // create_inventory_item_with_source is a plain RPC call, not
        // something the offline-write queue (resilient-write.ts) knows how
        // to replay -- it only understands insert/update/delete against a
        // single table. Falls back to the pre-RPC pattern instead (supply
        // the id ourselves, plain insert, same as this whole branch used
        // to work before create_inventory_item_with_source existed) so
        // item creation still works with no connection; a same-motion
        // reorder link becomes a second queued insert against the id
        // already generated above, which the FIFO offline queue replays
        // after the item it depends on. The atomic RPC (else branch) is
        // used whenever there's actually a connection to use it.
        const result = await resilientInsert(supabase, 'inventory_items', { ...payload, id });
        if (reorderUrl && result.ok) {
          await resilientInsert(supabase, 'reorder_sources', {
            property_id: propertyId,
            inventory_item_id: id,
            retailer_name: reorderRetailer || 'Other',
            url: reorderUrl,
            is_preferred: true,
          });
        }
        setSaving(false);
        if (!result.ok) {
          setError(result.error);
          showToast('Failed to add item.', { variant: 'error' });
          return;
        }
        // qr_code is DB-trigger-generated on insert — unknown here until the
        // next reload; null is accurate, not a placeholder to fix later.
        // pesach_status isn't part of the add-item form (a deliberate separate
        // classification, not a quick-add field) -- the DB column default
        // applies server-side, matched here for the optimistic local row.
        // last_counted_at is never set on INSERT (see the DB trigger) -- a
        // brand-new item is always "not yet counted."
        // updated_at defaults to now() server-side on insert -- approximated
        // here the same way, only relevant as the version-check baseline if
        // this exact item gets edited again before the next reload.
        setItems((prev) => [
          ...prev,
          {
            ...payload,
            id,
            qr_code: null,
            pesach_status: 'needs_review',
            last_counted_at: null,
            updated_at: new Date().toISOString(),
            reorder_link: reorderUrl || null,
            reorder_sources: optimisticSources,
          },
        ]);
        if (photoUploadError) {
          showToast(`Item added, but the photo failed to upload: ${photoUploadError}`, {
            variant: 'error',
            durationMs: 8000,
          });
        } else {
          showToast('Added — will sync when back online.', { variant: 'success' });
        }
        if (!payload.photo_url) setPhotoPromptItem({ id, name: payload.name });
      } else {
        // Atomic: the item and its first reorder source (if a URL was
        // given) insert in one server-side transaction, so this stays the
        // same one-motion action it's always been from the staff member's
        // side -- see create_inventory_item_with_source
        // (supabase/migrations). Returns the real row (real qr_code,
        // real DB-assigned id), so there's no optimistic approximation
        // needed here the way the offline branch above needs one.
        const { data: newItem, error: rpcError } = await supabase.rpc('create_inventory_item_with_source', {
          item_data: payload,
          source_retailer_name: reorderRetailer || null,
          source_url: reorderUrl || null,
        });
        setSaving(false);
        if (rpcError || !newItem) {
          setError(rpcError?.message ?? 'Failed to add item.');
          showToast('Failed to add item.', { variant: 'error' });
          return;
        }
        setItems((prev) => [...prev, { ...newItem, reorder_sources: optimisticSources }]);
        if (photoUploadError) {
          showToast(`Item added, but the photo failed to upload: ${photoUploadError}`, {
            variant: 'error',
            durationMs: 8000,
          });
        } else {
          showToast('Item added.', { variant: 'success' });
        }
        if (!payload.photo_url) setPhotoPromptItem({ id: newItem.id, name: newItem.name });
      }
    }

    setPendingPhotoFile(null);
    setPendingPhotoRemoved(false);
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

  // A room filter matches its own items PLUS everything stored in its
  // sub-locations (Kitchen's view includes Kitchen pantry, Kitchen Fridge,
  // etc.) -- a plain locationFilter === locationFilter equality only ever
  // caught items filed directly on the room itself, silently hiding
  // anything actually put away in one of its named sub-spots.
  const filterSubtreeIds = useMemo(() => {
    if (!locationFilter || locationFilter === UNASSIGNED || locationFilter === FAVORITES) return null;
    return new Set([locationFilter, ...getDescendantIds(locations, locationFilter)]);
  }, [locationFilter, locations]);

  const visibleItems = locationFilter
    ? locationFilter === UNASSIGNED
      ? items.filter((i) => i.location_id === null)
      : locationFilter === FAVORITES
      ? items.filter((i) => favoriteIds.has(i.id))
      : items.filter((i) => i.location_id !== null && filterSubtreeIds!.has(i.location_id))
    : items;

  // Direct sub-locations of whatever room is currently selected (Kitchen
  // pantry, Kitchen Fridge, ... under Kitchen) -- rendered as drill-down
  // chips in the single-room view so a room's own sub-spots stay reachable
  // now that they no longer get separate top-level cards.
  const currentSubLocations =
    locationFilter && locationFilter !== UNASSIGNED && locationFilter !== FAVORITES
      ? locations
          .filter((l) => l.parent_location_id === locationFilter)
          .map((loc) => {
            const subtreeIds = new Set([loc.id, ...getDescendantIds(locations, loc.id)]);
            const count = items.filter((i) => i.location_id !== null && subtreeIds.has(i.location_id)).length;
            return { loc, count };
          })
          .sort((a, b) => a.loc.name.localeCompare(b.loc.name))
      : [];

  const hasActiveFilter =
    searchQuery.trim() !== '' ||
    categoryFilter !== null ||
    belowParOnly ||
    expiringSoonOnly ||
    expiringSoon30Only ||
    (pesachModeEnabled && pesachStatusFilter !== null);

  function matchesFilters(item: InventoryItem) {
    const q = searchQuery.trim();
    if (q) {
      if (searchResults && searchResults.query === q) {
        if (!searchResults.ids.has(item.id)) return false;
      } else if (!item.name.toLowerCase().includes(q.toLowerCase())) {
        return false;
      }
    }
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (expiringSoon30Only && !isExpiringWithin30Days(item.expiration_date)) return false;
    if (belowParOnly && !isLowStock(item)) return false;
    if (expiringSoonOnly && !isExpiringSoon(item.expiration_date)) return false;
    if (pesachModeEnabled && pesachStatusFilter && item.pesach_status !== pesachStatusFilter) return false;
    return true;
  }

  // Counts against the full item list, not the currently-filtered subset --
  // matches the Recipes page's own filter-pill convention, so picking one
  // pill doesn't make the others' counts shift under you.
  const categoryPillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, [items]);
  const lowStockPillCount = useMemo(() => items.filter(isLowStock).length, [items]);
  const expiringSoonPillCount = useMemo(
    () => items.filter((i) => isExpiringSoon(i.expiration_date)).length,
    [items]
  );
  const pesachStatusPillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.pesach_status] = (counts[item.pesach_status] ?? 0) + 1;
    return counts;
  }, [items]);

  // Searching/filtering with no room selected searches across every room,
  // not just whatever the room grid happened to be showing.
  const displayItems = (locationFilter ? visibleItems : items).filter(matchesFilters);

  // All Items view ignores room selection entirely — it's the whole
  // inventory, still respecting the search/category/below-par overlay.
  const allItemsDisplay = items.filter(matchesFilters);

  // Grouped after filtering, so per-letter counts always reflect whatever
  // filter is active (category, below-par, search) rather than the whole
  // unfiltered inventory. Same helper powers both All Items and a single
  // room's item list below -- one collapsible-letters implementation, not two.
  const allItemsByLetter = useMemo(() => groupByLetter(allItemsDisplay), [allItemsDisplay]);
  const roomItemsByLetter = useMemo(() => groupByLetter(displayItems), [displayItems]);

  function toggleLetter(letter: string) {
    setCollapsedLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  const grouped = groupByLocation(visibleItems, locationName);

  if (loading) return <SkeletonList />;

  // Stat cards — real counts from the real fetched data, not placeholders.
  const totalItemsCount = items.length;
  const lowStockCount = items.filter(isLowStock).length;
  const expiringSoon30Count = items.filter((i) => isExpiringWithin30Days(i.expiration_date)).length;

  // Room summaries for the grid view — one card per real room (a location
  // one level below a top-level group like Basement/Main Floor/Upstairs),
  // not just ones that already have items. A brand-new empty room still
  // needs to show up so there's somewhere to actually add its first item --
  // deriving this from `grouped` alone silently dropped any room with zero
  // items.
  //
  // A room's own children (Kitchen pantry, Kitchen Fridge, ... under
  // Kitchen) do NOT get their own top-level card -- they used to, because
  // the old filter was just "has any parent," which can't tell a real room
  // apart from a sub-location of a room. That flattened Kitchen's 6
  // sub-locations into 6 extra sibling cards under Main Floor instead of
  // one Kitchen card. Now a card only exists for a location whose PARENT is
  // itself a root (parent_location_id === null); everything deeper rolls
  // into that room's count via getDescendantIds and shows up through the
  // sub-location drill-down inside the room instead (see the single-room
  // view below).
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const roomSummaries = locations
    .filter((l) => {
      if (l.parent_location_id === null) return false;
      const parent = locationById.get(l.parent_location_id);
      return !parent || parent.parent_location_id === null;
    })
    .map((loc) => {
      const subtreeIds = new Set([loc.id, ...getDescendantIds(locations, loc.id)]);
      const subtreeItems = items.filter((i) => i.location_id !== null && subtreeIds.has(i.location_id));
      return {
        location: loc.name,
        count: subtreeItems.length,
        lowCount: subtreeItems.filter(isLowStock).length,
      };
    });

  // Group room cards under their real top-level room (Basement / Main Floor
  // / Upstairs) now that locations have a real hierarchy, instead of one
  // flat grid — "Unassigned" (items with no location at all) goes last.
  const roomsByGroup = new Map<string, typeof roomSummaries>();
  for (const summary of roomSummaries) {
    const loc = locations.find((l) => l.name === summary.location);
    const group = loc ? rootGroupName(locations, loc.id) : 'Unassigned';
    (roomsByGroup.get(group) ?? roomsByGroup.set(group, []).get(group)!).push(summary);
  }
  const allFloorNames = [...roomsByGroup.keys()].filter((g) => g !== 'Unassigned').sort((a, b) => a.localeCompare(b));

  const roomGroupEntries = [...roomsByGroup.entries()]
    .filter(([groupName]) => !floorFilter || groupName === floorFilter)
    .sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    })
    .map(([groupName, summaries]) => {
      const sorted = [...summaries].sort((a, b) =>
        lowStockFirst ? b.lowCount - a.lowCount || a.location.localeCompare(b.location) : a.location.localeCompare(b.location)
      );
      return [groupName, sorted] as [string, typeof summaries];
    });

  function renderItemCard(item: InventoryItem, showLocation: boolean) {
    const low = isLowStock(item);
    const notYetCounted = item.last_counted_at === null;
    const hasThumb = !!item.photo_url && isDirectImageUrl(item.photo_url) && !brokenPhotoIds.has(item.id);
    const isFav = favoriteIds.has(item.id);
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 bg-card rounded-2xl shadow-card px-4 py-3.5 cursor-pointer hover:shadow-cardHover transition-shadow"
        onClick={() => openEditForm(item)}
      >
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url!}
            alt=""
            className="w-14 h-14 rounded-xl object-cover shrink-0 bg-mist"
            onError={() => setBrokenPhotoIds((prev) => new Set(prev).add(item.id))}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-mist shrink-0 flex items-center justify-center">
            {(() => {
              const Icon = getItemIcon(item.name, item.category, categoryIconNames[item.category ?? '']);
              return <Icon className="w-6 h-6 text-brass" strokeWidth={1.75} />;
            })()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-denim truncate">{displayName(item)}</p>
          <p className="text-xs text-dusk truncate mt-0.5">
            {[
              item.category ? `${categoryIcon(item.category)} ${item.category}` : null,
              showLocation ? locationName(item.location_id) : item.supplier,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {(() => {
              const colorClass = low ? 'text-rust bg-rust/10' : notYetCounted ? 'text-brass bg-mist' : 'text-dusk bg-mist';
              const label = notYetCounted
                ? 'Not yet counted'
                : `${item.current_qty} / ${item.min_qty} ${item.unit}${low ? ' — low' : ''}`;
              return (
                <div className="flex flex-col gap-1">
                  {/* Replaces the old tap-the-whole-card-to-open-the-edit-
                      form path for the single most common edit: adjusting
                      how much is on hand. stopPropagation everywhere here so
                      the card's own onClick (open full edit form) doesn't
                      also fire. */}
                  <div className={`flex items-center gap-0.5 rounded-full pl-1 pr-1 py-1 ${colorClass}`} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => adjustQuantity(item, -1)}
                      className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-sm font-bold hover:bg-black/10"
                      aria-label={`Decrease ${displayName(item)} quantity`}
                    >
                      −
                    </button>
                    <span className="text-xs font-medium px-1 whitespace-nowrap">{label}</span>
                    <button
                      onClick={() => {
                        if (longPressFiredRef.current) {
                          longPressFiredRef.current = false;
                          return;
                        }
                        adjustQuantity(item, 1);
                      }}
                      onMouseDown={() => startLongPress(item)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={() => startLongPress(item)}
                      onTouchEnd={cancelLongPress}
                      className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-sm font-bold hover:bg-black/10"
                      aria-label={
                        item.case_size
                          ? `Increase ${displayName(item)} quantity, hold for bulk add`
                          : `Increase ${displayName(item)} quantity`
                      }
                    >
                      +
                    </button>
                  </div>
                  {bulkAddItemId === item.id && item.case_size && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          adjustQuantity(item, Math.round(item.case_size! / 2));
                          setBulkAddItemId(null);
                        }}
                        className="text-[11px] font-medium text-denim bg-card border border-cardBorder px-2 py-1 rounded-full"
                      >
                        +{Math.round(item.case_size / 2)} (half case)
                      </button>
                      <button
                        onClick={() => {
                          adjustQuantity(item, item.case_size!);
                          setBulkAddItemId(null);
                        }}
                        className="text-[11px] font-medium text-denim bg-card border border-cardBorder px-2 py-1 rounded-full"
                      >
                        +{item.case_size} (full case)
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
            {pesachModeEnabled &&
              item.pesach_status !== 'not_applicable' &&
              (() => {
                const info = PESACH_STATUS_INFO[item.pesach_status];
                const Icon = info.icon;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${info.badgeClass}`}>
                    <Icon className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                    {info.label}
                  </span>
                );
              })()}
          </div>
        </div>
        <button
          onClick={(e) => toggleFavorite(item.id, e)}
          className="text-xl shrink-0 self-start w-11 h-11 -m-2.5 flex items-center justify-center"
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFav ? '⭐' : '☆'}
        </button>
        <span onClick={(e) => e.stopPropagation()} className="shrink-0 self-start">
          <OrderLink itemName={item.name} sources={item.reorder_sources} fallbackLink={item.reorder_link} />
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center text-xs text-dusk overflow-hidden transition-all"
          style={{ height: refreshing ? 32 : pullDistance }}
        >
          {refreshing ? 'Refreshing…' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-denim">Inventory</h1>
        <div className="flex gap-2">
          <a
            href={`/properties/${propertyId}/scan`}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-linen border border-brass/30 text-denim text-lg"
            aria-label="Scan a label"
          >
            📷
          </a>
          <a
            href={`/properties/${propertyId}/print-labels`}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-linen border border-brass/30 text-denim text-lg"
            aria-label="Print item labels"
          >
            🏷️
          </a>
          <button
            onClick={openNewItemForm}
            className="text-sm font-medium bg-denim text-white px-4 py-2 rounded-full"
          >
            + Add item
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl p-3 bg-card border border-cardBorder text-center">
          <div className="text-xl font-display text-denim">{totalItemsCount}</div>
          <div className="text-[11px] text-dusk">Total Items</div>
        </div>
        <button
          type="button"
          onClick={() => setBelowParOnly((v) => !v)}
          aria-pressed={belowParOnly}
          className={`rounded-2xl p-3 bg-card border text-center transition-colors ${
            belowParOnly ? 'border-rust' : 'border-cardBorder'
          }`}
        >
          <div className={`text-xl font-display ${lowStockCount > 0 ? 'text-rust' : 'text-denim'}`}>
            {lowStockCount}
          </div>
          <div className="text-[11px] text-dusk">Low Stock</div>
        </button>
        <button
          type="button"
          onClick={() => setExpiringSoon30Only((v) => !v)}
          aria-pressed={expiringSoon30Only}
          className={`rounded-2xl p-3 bg-card border text-center transition-colors ${
            expiringSoon30Only ? 'border-brass' : 'border-cardBorder'
          }`}
        >
          <div className={`text-xl font-display ${expiringSoon30Count > 0 ? 'text-brass' : 'text-denim'}`}>
            {expiringSoon30Count}
          </div>
          <div className="text-[11px] text-dusk">Expiring Soon</div>
        </button>
      </div>

      {/* Auto-restock moved to its own Shopping Rules settings page. Pesach
          Mode is now the only thing left in this area, so it reads as a
          lightweight settings row -- no card border/shadow, smaller text,
          same visual weight as an inline toggle rather than a second
          feature card competing with the item browser below it. */}
      {canManage(role) && (
        <div className="flex items-center justify-between gap-3 px-1 mb-4">
          <p className="text-xs text-dusk">Pesach Mode</p>
          <button
            onClick={togglePesachMode}
            disabled={savingPesachMode}
            role="switch"
            aria-checked={pesachModeEnabled}
            aria-label="Toggle Pesach Mode"
            className={`relative shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
              pesachModeEnabled ? 'bg-denim' : 'bg-mist'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-transform ${
                pesachModeEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      <div className="inline-flex rounded-full border border-cardBorder bg-card p-0.5 text-sm mb-4">
        <button
          onClick={() => setViewMode('rooms')}
          className={`rounded-full px-4 py-1.5 ${viewMode === 'rooms' ? 'bg-denim text-white' : 'text-dusk'}`}
        >
          Browse by Room
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`rounded-full px-4 py-1.5 ${viewMode === 'all' ? 'bg-denim text-white' : 'text-dusk'}`}
        >
          All Items
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items…"
          className="flex-1 min-w-[140px] border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2 bg-card text-sm"
        />
        {/* Browse by Room keeps its exact original filter UI (dropdown +
            toggle button) untouched -- it's a genuinely different, spatial
            view. Only All Items gets the new pill treatment below. */}
        {viewMode === 'rooms' && (
          <>
            <select
              value={categoryFilter ?? ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="border border-cardBorder rounded-full px-3 py-2 bg-card text-sm"
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
                belowParOnly ? 'bg-rust text-white border-rust' : 'border-cardBorder text-denim'
              }`}
            >
              Below par only
            </button>
          </>
        )}
      </div>

      {viewMode === 'all' && (
        <div className="mb-4 space-y-3">
          <FilterPillRow label="Category">
            {categorySuggestions.map((c) => (
              <FilterPill
                key={c}
                active={categoryFilter === c}
                icon={categoryIcon(c)}
                label={c}
                count={categoryPillCounts[c] ?? 0}
                onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
              />
            ))}
          </FilterPillRow>
          <FilterPillRow label="Status">
            <FilterPill
              active={belowParOnly}
              icon={AlertTriangle}
              label="Low Stock"
              count={lowStockPillCount}
              onClick={() => setBelowParOnly((v) => !v)}
            />
            <FilterPill
              active={expiringSoonOnly}
              icon={Clock}
              label="Expiring Soon"
              count={expiringSoonPillCount}
              onClick={() => setExpiringSoonOnly((v) => !v)}
            />
          </FilterPillRow>
          {pesachModeEnabled && (
            <FilterPillRow label="Pesach Status">
              {(Object.keys(PESACH_STATUS_INFO) as (keyof typeof PESACH_STATUS_INFO)[]).map((status) => {
                const info = PESACH_STATUS_INFO[status];
                return (
                  <FilterPill
                    key={status}
                    active={pesachStatusFilter === status}
                    icon={info.icon}
                    label={info.label}
                    count={pesachStatusPillCounts[status] ?? 0}
                    onClick={() => setPesachStatusFilter(pesachStatusFilter === status ? null : status)}
                  />
                );
              })}
            </FilterPillRow>
          )}
        </div>
      )}

      {viewMode === 'all' ? (
        // ---- All Items: whole inventory, ignoring room selection, grouped
        // into collapsible A-Z letter sections (this is the longest list in
        // the app -- 698 items -- so collapsing actually helps here) ----
        <div className="space-y-3">
          {allItemsByLetter.map(([letter, letterItems]) => {
            const collapsed = collapsedLetters.has(letter);
            return (
              <div key={letter}>
                <button
                  onClick={() => toggleLetter(letter)}
                  className="w-full flex items-center gap-2 mb-2 text-left"
                >
                  <span className="font-display text-lg text-denim">{letter}</span>
                  <span className="text-xs text-dusk">({letterItems.length})</span>
                  <span className="flex-1 border-t border-cardBorder" />
                  <span className="text-dusk text-sm">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
                    {letterItems.map((item) => renderItemCard(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !locationFilter && !hasActiveFilter ? (
        // ---- Room grid: pick a room to see what's inside, grouped by real top-level room ----
        <div className="space-y-5">
          {favoriteIds.size > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <button
                onClick={() => setLocationFilter(FAVORITES)}
                className="text-left bg-mist rounded-2xl shadow-card p-4 hover:bg-mist transition-colors"
              >
                <p className="font-display text-lg text-denim truncate">⭐ Favorites</p>
                <p className="text-xs text-dusk mt-1">
                  {favoriteIds.size} item{favoriteIds.size === 1 ? '' : 's'}
                </p>
              </button>
            </div>
          )}
          {roomSummaries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setLowStockFirst((v) => !v)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  lowStockFirst ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk'
                }`}
              >
                Low stock first
              </button>
              {allFloorNames.length > 1 && (
                <>
                  <span className="w-px h-5 bg-cardBorder" aria-hidden="true" />
                  <button
                    onClick={() => setFloorFilter(null)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                      !floorFilter ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk'
                    }`}
                  >
                    All floors
                  </button>
                  {allFloorNames.map((floor) => (
                    <button
                      key={floor}
                      onClick={() => setFloorFilter(floor)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                        floorFilter === floor ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk'
                      }`}
                    >
                      {floor}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {roomGroupEntries.map(([groupName, summaries]) => (
            <div key={groupName}>
              {roomGroupEntries.length > 1 && (
                <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-2">{groupName}</h2>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {summaries.map(({ location, count, lowCount }) => {
                  const loc = locations.find((l) => l.name === location);
                  const Icon = getLocationIcon(location);
                  return (
                    <button
                      key={location}
                      onClick={() => setLocationFilter(loc ? loc.id : UNASSIGNED)}
                      className="relative text-left bg-card rounded-2xl shadow-card overflow-hidden hover:bg-mist transition-colors"
                    >
                      {loc?.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loc.photo_url} alt="" className="w-full h-20 object-cover" />
                      )}
                      <div className="p-4">
                        <Icon className="w-5 h-5 text-brass mb-1.5" strokeWidth={1.75} />
                        <p className="font-display text-lg text-denim truncate">{location}</p>
                        <p className="text-xs text-dusk mt-1">
                          {count} item{count === 1 ? '' : 's'}
                        </p>
                        {lowCount > 0 && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-white bg-rust px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                            {lowCount} low
                          </span>
                        )}
                      </div>
                      {loc && canManage(role) && !loc.photo_url && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoUploadLocation(loc);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-card/90 shadow-sm flex items-center justify-center text-dusk hover:text-denim"
                          role="button"
                          aria-label={`Add photo of ${location}`}
                        >
                          <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </span>
                      )}
                      {loc && canManage(role) && loc.photo_url && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoUploadLocation(loc);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/70 flex items-center justify-center text-dusk hover:text-denim hover:bg-card/90 transition-colors"
                          role="button"
                          aria-label={`Replace photo of ${location}`}
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
            className="text-left border-2 border-dashed border-cardBorder rounded-2xl p-4 text-dusk hover:bg-mist transition-colors w-full md:w-auto"
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
            className="flex items-center gap-1 text-sm text-denim mb-3 font-medium"
          >
            ← Rooms
          </button>
          <h2 className="font-display text-lg text-denim mb-2">
            {locationFilter === FAVORITES ? '⭐ Favorites' : locationPath(locations, locationFilter)}
          </h2>
          {currentSubLocations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {currentSubLocations.map(({ loc, count }) => (
                <button
                  key={loc.id}
                  onClick={() => setLocationFilter(loc.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-card border border-cardBorder text-dusk hover:bg-mist transition-colors"
                >
                  {loc.name} <span className="text-dusk">({count})</span>
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {roomItemsByLetter.map(([letter, letterItems]) => {
              const collapsed = collapsedLetters.has(letter);
              return (
                <div key={letter}>
                  <button
                    onClick={() => toggleLetter(letter)}
                    className="w-full flex items-center gap-2 mb-2 text-left"
                  >
                    <span className="font-display text-lg text-denim">{letter}</span>
                    <span className="text-xs text-dusk">({letterItems.length})</span>
                    <span className="flex-1 border-t border-cardBorder" />
                    <span className="text-dusk text-sm">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && (
                    <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5">
                      {letterItems.map((item) => renderItemCard(item, false))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {(viewMode === 'all' ? allItemsDisplay : displayItems).length === 0 && (
        <p className="text-sm text-dusk text-center mt-8">
          {hasActiveFilter
            ? 'No items match your search.'
            : locationFilter === FAVORITES
            ? 'No favorites yet — tap the star on any item.'
            : locationFilter
            ? 'No items in this area yet.'
            : 'No items yet. Tap "Add item" to get started.'}
        </p>
      )}

      <div className="mt-8 pt-4 border-t border-cardBorder">
        <h2 className="text-xs font-medium uppercase tracking-wider text-dusk mb-2">Inventory Ops Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INVENTORY_OPS_LINKS.map((tool) => (
            <a
              key={tool.slug}
              href={`/properties/${propertyId}/tools/${tool.slug}`}
              className="flex flex-col items-center text-center gap-2 bg-card rounded-xl2 shadow-card px-3 py-4 hover:shadow-cardHover transition-shadow"
            >
              <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-brass/15 text-lg" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="text-xs font-bold text-denim">{tool.title}</span>
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
          onPhotoChange={(file, removed) => {
            setPendingPhotoFile(file);
            setPendingPhotoRemoved(removed);
          }}
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
            className="bg-card w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-denim mb-3">New room</h2>
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. Kitchen Pantry"
              className="w-full border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen/40 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveNewRoom()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewRoom(false)}
                className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
              >
                Cancel
              </button>
              <button
                onClick={saveNewRoom}
                disabled={savingRoom || !newRoomName.trim()}
                className="flex-1 py-2.5 rounded-full bg-denim text-white disabled:opacity-40"
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

// Same A-Z letter-group shape used by the Recipes grid and the Tools hub --
// non-letter-leading names fall into a trailing "#" bucket.
function groupByLetter(items: InventoryItem[]): [string, InventoryItem[]][] {
  const map = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const firstChar = item.name.trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(item);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });
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
  return <label className="block text-xs font-medium text-dusk mb-1">{children}</label>;
}

const fieldClass =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-2xl px-4 py-2.5 bg-linen/40';

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
  onPhotoChange,
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
  onPhotoChange: (file: File | null, removed: boolean) => void;
}) {
  const restockInterval = restockIntervalDays(history);
  const lastPurchased = lastPurchasedDate(history);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function applyPhoto(file: File) {
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoRemoved(false);
    onPhotoChange(file, false);
  }

  function handleGalleryFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    applyPhoto(file);
  }

  function handleCameraFile(file: File) {
    setShowCamera(false);
    applyPhoto(file);
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPhotoRemoved(true);
    onPhotoChange(null, true);
  }

  const displayedPhoto = photoPreview ?? (photoRemoved ? null : form.photo_url || null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={onCancel}>
      <div
        className="bg-card w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-denim mb-3">{form.id ? 'Edit item' : 'New item'}</h2>

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
            <FieldLabel>Spanish Name *</FieldLabel>
            <input
              className={fieldClass}
              placeholder="Nombre en español"
              value={form.name_es}
              onChange={(e) => onChange({ ...form, name_es: e.target.value })}
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
            <p className="text-xs font-medium uppercase tracking-wider text-brass mb-2">Quantity</p>
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
            <div className="mt-2">
              <FieldLabel>Case size (optional)</FieldLabel>
              <input
                type="number"
                min="1"
                placeholder="e.g. 12 -- enables quick bulk-add on the card"
                className={fieldClass}
                value={form.case_size}
                onChange={(e) => onChange({ ...form, case_size: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Preferred store</FieldLabel>
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

          {!form.id && (
            <div>
              <FieldLabel>Reorder Link</FieldLabel>
              <input
                className={fieldClass}
                placeholder="URL"
                value={form.reorder_link}
                onChange={(e) => onChange({ ...form, reorder_link: e.target.value })}
              />
            </div>
          )}

          <div>
            <FieldLabel>Photo</FieldLabel>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleGalleryFile(e.target.files)}
            />
            <CameraCapture open={showCamera} onCapture={handleCameraFile} onClose={() => setShowCamera(false)} />
            {displayedPhoto ? (
              <div>
                <img
                  src={displayedPhoto}
                  alt=""
                  className="w-full h-40 object-cover rounded-2xl border border-cardBorder"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex-1 py-2 rounded-full bg-linen border border-brass/30 text-denim text-xs font-medium"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 py-2 rounded-full bg-linen border border-brass/30 text-denim text-xs font-medium"
                  >
                    Library
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="flex-1 py-2 rounded-full bg-linen border border-rust/40 text-rust text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="h-24 rounded-2xl border-2 border-dashed border-cardBorder text-dusk text-sm font-medium hover:bg-mist transition"
                >
                  📷 Take a photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-24 rounded-2xl border-2 border-dashed border-cardBorder text-dusk text-sm font-medium hover:bg-mist transition"
                >
                  🖼️ Choose photo
                </button>
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Barcode</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-dusk font-mono border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen/40 truncate">
                {form.qr_code ?? 'Generated on save'}
              </span>
              {form.id && (
                <a
                  href={`/properties/${propertyId}/scan`}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-linen border border-brass/30 text-denim text-lg"
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

          <div>
            <FieldLabel>Opened Date</FieldLabel>
            <input
              type="date"
              className={fieldClass}
              value={form.opened_date}
              onChange={(e) => onChange({ ...form, opened_date: e.target.value })}
            />
          </div>

          <label className="flex items-center justify-between bg-linen/40 border border-cardBorder rounded-2xl px-4 py-2.5 cursor-pointer">
            <span className="text-sm text-denim">Print Label</span>
            <input
              type="checkbox"
              checked={form.print_label}
              onChange={(e) => onChange({ ...form, print_label: e.target.checked })}
              className="h-5 w-5 accent-brass rounded"
            />
          </label>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-full bg-denim text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="w-full text-center text-sm text-rust mt-3">
            Delete item
          </button>
        )}

        {form.id && <ReorderSourcesEditor itemId={form.id} propertyId={propertyId} />}

        {form.id && isFoodCategory(form.category) && (
          <div className="mt-5 pt-4 border-t border-cardBorder">
            <InventoryBracha itemId={form.id} itemName={form.name} />
          </div>
        )}

        {form.id && (
          <div className="mt-5 pt-4 border-t border-cardBorder space-y-2">
            {lastPurchased && (
              <p className="text-xs text-dusk bg-mist rounded-lg px-3 py-2">
                Last purchased{' '}
                {lastPurchased.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            {restockInterval !== null && (
              <p className="text-xs text-dusk bg-mist rounded-lg px-3 py-2">
                Usually restocked every ~{restockInterval} day{restockInterval === 1 ? '' : 's'}
              </p>
            )}
            {/* 3f-i: "likely out by" only when both real numbers exist to
                project from -- a single fact alone isn't enough to predict
                a date, and this ships now rather than waiting on more usage
                data, per the standing instruction not to fake a forecast. */}
            {restockInterval !== null && lastPurchased && (
              <p className="text-xs text-dusk bg-mist rounded-lg px-3 py-2">
                At that pace, likely to run out around{' '}
                {new Date(lastPurchased.getTime() + restockInterval * 24 * 60 * 60 * 1000).toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric', year: 'numeric' }
                )}
              </p>
            )}
            {restockInterval === null && !lastPurchased && (
              <p className="text-xs text-dusk bg-mist rounded-lg px-3 py-2">
                Not enough usage history yet to predict restock timing.
              </p>
            )}
          </div>
        )}

        {form.id && (
          <div className="mt-5 pt-4 border-t border-cardBorder">
            <p className="text-xs font-display italic text-dusk mb-2">History</p>
            {historyLoading ? (
              <p className="text-xs text-dusk">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-dusk">No changes recorded yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-dusk">
                    <span className="text-dusk">
                      {new Date(h.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>{' '}
                    — {describeHistoryEntry(h)}
                    {h.actor_name && <span className="text-dusk"> · {h.actor_name}</span>}
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

// Most recent quantity_changed row where the number actually went UP — a
// restock, not a consumption decrease (or an unrelated field edit). Derived
// from history rather than a new column so it can never drift out of sync
// with what actually happened.
function lastPurchasedDate(history: HistoryEntry[]): Date | null {
  const restocks = history
    .filter((h) => h.action_type === 'quantity_changed')
    .filter((h) => {
      const oldVal = Number(h.old_value);
      const newVal = Number(h.new_value);
      return Number.isFinite(oldVal) && Number.isFinite(newVal) && newVal > oldVal;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return restocks.length > 0 ? new Date(restocks[0].created_at) : null;
}

function describeHistoryEntry(h: HistoryEntry): string {
  if (h.action_type === 'created') return 'Item created';
  if (h.action_type === 'deleted') return 'Item deleted';
  if (h.action_type === 'quantity_changed') return `Quantity ${h.old_value ?? '?'} → ${h.new_value ?? '?'}`;
  if (h.field_name === 'name') return `Renamed "${h.old_value}" → "${h.new_value}"`;
  if (h.field_name) return `${h.field_name.replace('_', ' ')} changed`;
  return 'Updated';
}
