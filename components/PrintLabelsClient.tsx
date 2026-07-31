// components/PrintLabelsClient.tsx
// Requires: npm install jspdf qrcode
// Rebuilt per direct feedback: labels are now per INVENTORY ITEM (with photo),
// not per storage location. Layout: Avery 22807 (20 labels/sheet, 4x5 grid of 2"×2" squares).
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { List, type RowComponentProps } from 'react-window';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { SITE_URL } from '@/lib/site-url';
import { useSessionPersistedState } from '@/lib/use-session-persisted-state';
import { storageThumbnail } from '@/lib/storage-image';
import { isInventoryItemLow } from '@/lib/low-stock';

type Item = {
  id: string;
  name: string;
  name_es: string | null;
  qr_code: string;
  photo_url: string | null;
  print_label: boolean;
  location_id: string | null;
  category: string | null;
  category_group: string | null;
  current_qty: number;
  min_qty: number;
  auto_restock_eligible: boolean;
  last_counted_at: string | null;
  updated_at: string;
  label_printed_at: string | null;
};

type LabelStatus = 'unlabeled' | 'needs_update' | 'printed';

function labelStatus(item: Pick<Item, 'updated_at' | 'label_printed_at'>): LabelStatus {
  if (!item.label_printed_at) return 'unlabeled';
  return new Date(item.updated_at) > new Date(item.label_printed_at) ? 'needs_update' : 'printed';
}

const LABEL_STATUS_TEXT: Record<LabelStatus, string> = {
  unlabeled: 'Unlabeled / New',
  needs_update: 'Needs Update',
  printed: 'Printed',
};

// Macro/micro sort. category is reliably populated (every item has one);
// category_group is sparse (~20% of items on Main) and, where set, is
// sometimes a genuine sub-type (Produce -> Fruit/Vegetable) and sometimes
// just a duplicate of category -- there's no clean, fully-populated second
// tier to sort on yet. Micro mode surfaces the finer split for the items
// that have one and falls back to the same category everyone else uses,
// rather than pretending a distinction exists where the data doesn't have
// it.
function sortCategory(item: Pick<Item, 'category' | 'category_group'>, mode: 'macro' | 'micro'): string {
  const fallback = item.category ?? 'Uncategorized';
  if (mode === 'macro') return fallback;
  return item.category_group ?? fallback;
}

// The definition of "low" lives in lib/low-stock.ts, the TS mirror of
// migration 158's is_inventory_item_low(). This file used to carry its own
// July-19-era copy (bare current_qty <= min_qty) which was never updated
// for the SS-157 reversal -- so the "Low stock" filter here counted
// never-counted 0/0 items as low while every other surface had stopped.
// Aligned 31 Jul: never-counted and non-auto-restock items no longer match
// this filter, same as everywhere else.
const isLowStock = isInventoryItemLow;

type Location = { id: string; name: string };

const AVERY_22807 = {
  cols: 4,
  rows: 5,
  labelWidth: 2,
  labelHeight: 2,
  marginLeft: 0.25,
  marginTop: 0.5,
  colGap: 0,
  rowGap: 0,
};

// Plain Drive "file/.../view" links can't be embedded as images. Drive's
// thumbnail endpoint can be hotlinked as an <img> src, so it's treated as
// valid here — but note this PDF path uses fetch() to pull the bytes for
// jsPDF, which is more CORS-restrictive than a plain <img> tag. It may
// still silently skip the photo (see loadImageAsDataUrl's catch below)
// even for a URL this function accepts.
function isDirectImageUrl(url: string) {
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

// A slow/unreachable photo URL used to hang the ENTIRE batch forever with
// no error (fetch() has no default timeout) — the 5s AbortController limit
// plus the console.warn below are what actually fixes that, so whoever's
// debugging next print run can see which photo_url was the culprit.
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    // CORS-blocked, unreachable, or timed out — skip the photo for this one
    // label rather than failing (or hanging) the whole PDF.
    console.warn(
      err instanceof Error && err.name === 'AbortError'
        ? `Label photo timed out after 5s, skipping: ${url}`
        : `Label photo failed to load, skipping: ${url}`,
      err
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_LABEL_NAME_LENGTH = 35;

// Above this many selected labels the page stops merely reporting the size
// and starts warning about it. 100 = 5 sheets; Racquel can move it.
const LARGE_BATCH_WARNING = 100;
function truncateForLabel(name: string): string {
  return name.length > MAX_LABEL_NAME_LENGTH ? name.slice(0, MAX_LABEL_NAME_LENGTH - 1) + '…' : name;
}

// The printed name only -- grouping/selection stays keyed on item.name
// (the canonical field) regardless of this toggle, so switching language
// mid-selection can't shuffle which rows are grouped together or silently
// change what's selected. Falls back to English for the small number of
// items missing a Spanish name rather than printing a blank label.
function labelName(item: Pick<Item, 'name' | 'name_es'>, lang: 'en' | 'es'): string {
  return lang === 'es' && item.name_es ? item.name_es : item.name;
}

export default function PrintLabelsClient({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SS-016: survives a phone lock / backgrounded-tab reload the same way
  // Inventory and Recipes' filters already do -- previously plain useState,
  // so switching properties or a background reload silently dropped
  // whatever search/location/photo filter was active mid-print-run.
  const [search, setSearch] = useSessionPersistedState('print-labels-filter-search', '');
  const [locationFilter, setLocationFilter] = useSessionPersistedState<string | null>('print-labels-filter-location', null);
  const [photosOnly, setPhotosOnly] = useSessionPersistedState('print-labels-filter-photosOnly', false);
  // SS-015. Uses the app-wide low-stock definition (lib/low-stock.ts) --
  // see the note at isLowStock above.
  const [lowStockOnly, setLowStockOnly] = useSessionPersistedState('print-labels-filter-lowStockOnly', false);
  const [labelLanguage, setLabelLanguage] = useSessionPersistedState<'en' | 'es'>('print-labels-language', 'en');
  const [sortMode, setSortMode] = useSessionPersistedState<'macro' | 'micro'>('print-labels-sortMode', 'macro');
  const [categoryFilter, setCategoryFilter] = useSessionPersistedState<string | null>('print-labels-filter-category', null);
  const [labelStatusFilter, setLabelStatusFilter] = useSessionPersistedState<LabelStatus | null>('print-labels-filter-labelStatus', null);
  const [showSelectionPanel, setShowSelectionPanel] = useState(false);
  const showToast = useToast();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase
        .from('inventory_items')
        .select(
          'id, name, name_es, qr_code, photo_url, print_label, location_id, category, category_group, current_qty, min_qty, auto_restock_eligible, last_counted_at, updated_at, label_printed_at'
        )
        .eq('property_id', propertyId)
        .order('name'),
      supabase.from('locations').select('id, name').eq('property_id', propertyId).neq('is_active', false).order('name'),
    ]).then(([itemsRes, locationsRes]) => {
      if (cancelled) return;
      if (itemsRes.error) {
        setError(itemsRes.error.message);
        setLoading(false);
        return;
      }
      const data = itemsRes.data ?? [];
      setItems(data);
      setLocations(locationsRes.data ?? []);
      // SS-296: the page used to arrive with every print_label item already
      // selected. That is a large batch chosen for you before you have
      // looked at anything -- it rendered a full preview on load and put a
      // hundreds-of-labels PDF one tap away. The same set is still one
      // click away via "Load flagged", which makes it a decision instead
      // of a default. Selection now starts empty.
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleGroup(groupItems: Item[]) {
    const allSelected = groupItems.every((i) => selected.has(i.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of groupItems) {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });
  }

  function selectAll(value: boolean) {
    // Same Produce exclusion as the flagged default — "Select all" is the
    // other place a bulk-select would otherwise silently re-include them.
    setSelected(value ? new Set(items.filter((i) => i.category !== 'Produce').map((i) => i.id)) : new Set());
  }

  // Exactly the predicate the mount effect used to apply silently: the
  // item's own Print Label toggle, minus Produce (a permanent QR sticker
  // makes no sense on something perishable). Computed always, applied only
  // when asked. Deliberately NOT narrowed by the active filters -- it means
  // "everything flagged", and quietly loading a subset under that label
  // would be the same kind of invisible decision this change removes.
  const flaggedIds = useMemo(
    () => items.filter((i) => i.print_label && i.category !== 'Produce').map((i) => i.id),
    [items]
  );

  function loadFlagged() {
    setSelected(new Set(flaggedIds));
  }

  // SS-298 asked for a join to locations to get the name onto each label.
  // No join is needed: this component already loads every location for the
  // property (for the filter dropdown) and every item already carries
  // location_id, so it is a lookup, not a fetch.
  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  // Cross-narrowing: every filter's own option list only offers choices
  // that actually exist given every OTHER active filter -- e.g. once a
  // location is picked, the category dropdown drops any category with zero
  // items in that location. "Leave-one-out": each filter's own current
  // value is deliberately excluded from its own narrowing pass (matched
  // against every filter EXCEPT itself), not from all of them -- otherwise
  // a dropdown would trivially only ever show its own already-selected
  // value and nothing else to switch to. This is the reference
  // implementation for the standing rule (every filter, everywhere in the
  // app, narrows the others) -- same five-line pattern, copy per page
  // rather than a premature shared abstraction before a second real
  // consumer exists.
  const q = search.trim().toLowerCase();
  function matchesExcept(item: Item, exclude: 'location' | 'category' | 'photos' | 'lowStock' | 'labelStatus' | null): boolean {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (exclude !== 'location' && locationFilter && item.location_id !== locationFilter) return false;
    if (exclude !== 'photos' && photosOnly && !(item.photo_url && isDirectImageUrl(item.photo_url))) return false;
    if (exclude !== 'lowStock' && lowStockOnly && !isLowStock(item)) return false;
    if (exclude !== 'category' && categoryFilter && sortCategory(item, sortMode) !== categoryFilter) return false;
    if (exclude !== 'labelStatus' && labelStatusFilter && labelStatus(item) !== labelStatusFilter) return false;
    return true;
  }

  // A Map rather than a Set so each option can show how many items picking
  // it would actually yield. The count is leave-one-out, exactly like
  // photosOnlyCount: it reflects every OTHER active filter, so "Kitchen
  // (214)" means 214 given what is already narrowed, not 214 in the
  // property. A raw unfiltered count would promise items that the current
  // filters have already excluded.
  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items)
      if (i.location_id && matchesExcept(i, 'location'))
        counts.set(i.location_id, (counts.get(i.location_id) ?? 0) + 1);
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, photosOnly, lowStockOnly, categoryFilter, sortMode, labelStatusFilter]);

  // Options change shape with the mode too (macro: broad categories only;
  // micro: finer split where it exists) -- recomputed whenever sortMode
  // flips so the dropdown never offers a value the current mode can't
  // actually match, on top of the narrowing from every other filter.
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items)
      if (matchesExcept(i, 'category')) {
        const c = sortCategory(i, sortMode);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, locationFilter, photosOnly, lowStockOnly, sortMode, labelStatusFilter]);

  // Checkboxes/pills aren't a dropdown with a discrete option list to trim,
  // but the same rule applies: never leave a choice on-screen that's
  // guaranteed to produce zero results given everything else selected.
  // Counted (not just true/false) so a manager can see 0 before tapping it,
  // not after.
  const photosOnlyCount = useMemo(() => {
    return items.filter((i) => matchesExcept(i, 'photos') && i.photo_url && isDirectImageUrl(i.photo_url)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, locationFilter, lowStockOnly, categoryFilter, sortMode, labelStatusFilter]);

  const lowStockOnlyCount = useMemo(() => {
    return items.filter((i) => matchesExcept(i, 'lowStock') && isLowStock(i)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, locationFilter, photosOnly, categoryFilter, sortMode, labelStatusFilter]);

  const labelStatusCounts = useMemo(() => {
    const counts: Record<LabelStatus, number> = { unlabeled: 0, needs_update: 0, printed: 0 };
    for (const i of items) {
      if (!matchesExcept(i, 'labelStatus')) continue;
      counts[labelStatus(i)]++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, locationFilter, photosOnly, lowStockOnly, categoryFilter, sortMode]);

  function handleSortModeChange(mode: 'macro' | 'micro') {
    setSortMode(mode);
    setCategoryFilter(null);
  }

  const filteredItems = useMemo(() => {
    return items.filter((i) => matchesExcept(i, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, locationFilter, photosOnly, lowStockOnly, categoryFilter, sortMode, labelStatusFilter]);

  // Same-named items (real per-location duplicates — intentional, not data
  // dirt) collapse into one pickable row here for a cleaner list, but each
  // underlying row still gets its own physical label — this is a display
  // simplification only, not a merge of the real inventory data.
  const groupedItems = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filteredItems) {
      if (!map.has(item.name)) map.set(item.name, []);
      map.get(item.name)!.push(item);
    }
    return [...map.entries()]
      .map(([name, groupItems]) => ({ name, items: groupItems }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredItems]);

  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);

  // Grouped over the full item list (not the currently-filtered/visible
  // one) so a selected item still shows up here to be removed even if the
  // active search/filter would otherwise hide it — the whole point is not
  // having to scroll back through the virtualized list to find it again.
  const selectedGroups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      if (!map.has(item.name)) map.set(item.name, []);
      map.get(item.name)!.push(item);
    }
    return [...map.entries()]
      .map(([name, groupItems]) => ({ name, items: groupItems }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, selected]);

  async function generatePdf(testOnly: boolean = false) {
    setGenerating(true);
    setError(null);
    try {
      const t = AVERY_22807;
      const perPage = t.cols * t.rows;
      // A test sheet is exactly one real physical sheet worth of the
      // current selection (first 20), so a misclick on the full batch
      // doesn't waste actual label stock — print this one sheet, check
      // alignment/photos, then run the real batch.
      const toPrint = testOnly ? items.filter((i) => selected.has(i.id)).slice(0, perPage) : items.filter((i) => selected.has(i.id));
      const doc = new jsPDF({ unit: 'in', format: 'letter' });

      // Batch-fetch every photo concurrently before the render loop instead
      // of blocking sequentially inside it — one slow photo used to stall
      // every label behind it in the batch.
      const photoDataById = new Map<string, string | null>();
      await Promise.all(
        toPrint.map(async (item) => {
          if (item.photo_url && isDirectImageUrl(item.photo_url)) {
            photoDataById.set(item.id, await loadImageAsDataUrl(item.photo_url));
          }
        })
      );

      for (let i = 0; i < toPrint.length; i++) {
        const item = toPrint[i];
        const posOnPage = i % perPage;
        if (i > 0 && posOnPage === 0) doc.addPage();

        const col = posOnPage % t.cols;
        const row = Math.floor(posOnPage / t.cols);
        const x = t.marginLeft + col * (t.labelWidth + t.colGap);
        const y = t.marginTop + row * (t.labelHeight + t.rowGap);

        // Encode a full URL, not the bare code — a physical sticker is
        // scanned with whatever camera app staff have open, not necessarily
        // this app's own in-app scanner. /scan/[code] looks the code up and
        // redirects straight into the item's Scan screen (reorder link one
        // tap away). SITE_URL, not window.location.origin -- a label printed
        // from a local dev session would otherwise encode a localhost URL
        // that fails the moment it's scanned on a real phone (same bug
        // class as the auth-email redirect issue).
        const qrUrl = `${SITE_URL}/scan/${encodeURIComponent(item.qr_code)}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 0 });
        const qrSize = 0.6;

        // Square label layout: photo at top-center, QR at bottom-left, name at bottom-right
        const photoData = photoDataById.get(item.id) ?? null;

        // Photo at top center (0.8" × 0.8")
        if (photoData) {
          const photoSize = 0.8;
          const photoCenterX = x + (t.labelWidth - photoSize) / 2;
          doc.addImage(photoData, photoCenterX, y + 0.1, photoSize, photoSize);
        }

        // QR code at bottom-left
        doc.addImage(qrDataUrl, 'PNG', x + 0.08, y + t.labelHeight - qrSize - 0.08, qrSize, qrSize);

        // Location, as a small grey kicker ABOVE the item name (SS-298).
        //
        // The brief asked for it directly UNDER the name. Measured with
        // jsPDF at the real sizes, that position is already occupied:
        // truncateForLabel caps names at 35 characters, but 35 characters
        // at 7pt is ~1.75" against a 1.1" text column, so long names
        // ALREADY wrap to a second line whose baseline lands at 1.812" --
        // within a thousandth of an inch of where the location line would
        // have gone. Three of the four longest real item names wrap. A
        // fourth line under the name would have needed a baseline at
        // ~1.97" on a 2" label: descenders on the sticker edge.
        //
        // Above the name is genuinely free: the photo ends at 0.9" and the
        // name's cap height starts at ~1.63". Sitting at 1.58" it clears
        // both, stays in the same text column so it reads as deliberate,
        // and -- unlike anything below the name -- is unaffected by
        // whether the name wraps. Widest real location ("Basement Common
        // Area") is 0.852" at 5.5pt, inside the 1.1" column.
        const locationName = item.location_id ? locationById.get(item.location_id) ?? null : null;
        if (locationName) {
          doc.setFontSize(5.5);
          doc.setTextColor(120);
          // splitTextToSize rather than a character cap: the column is
          // measured in inches, and it was a character cap that let the
          // name overflow in the first place.
          const [locLine] = doc.splitTextToSize(locationName, t.labelWidth - qrSize - 0.3);
          doc.text(locLine, x + qrSize + 0.18, y + t.labelHeight - 0.42);
          doc.setTextColor(0);
        }

        // Item name at bottom-right of QR
        doc.setFontSize(7);
        doc.setTextColor(0);
        const nameX = x + qrSize + 0.18;
        const nameY = y + t.labelHeight - 0.3;
        // jsPDF's maxWidth wraps rather than clips — a long name would wrap
        // onto extra lines and bleed past the label's physical edge instead
        // of staying on one line, so truncate explicitly first.
        doc.text(truncateForLabel(labelName(item, labelLanguage)), nameX, nameY, { maxWidth: t.labelWidth - qrSize - 0.3 });

        // Human-readable code below name — a fallback for when a QR won't scan
        doc.setFontSize(4.5);
        doc.setTextColor(150);
        doc.text(item.qr_code, nameX, y + t.labelHeight - 0.08, {
          maxWidth: t.labelWidth - qrSize - 0.3,
        });
        doc.setTextColor(0);
      }

      doc.save(testOnly ? `item-labels-test-sheet-${propertyId}.pdf` : `item-labels-${propertyId}.pdf`);
      showToast(
        testOnly
          ? `Generated 1 test sheet (${toPrint.length} label${toPrint.length === 1 ? '' : 's'}).`
          : `Generated ${toPrint.length} label${toPrint.length === 1 ? '' : 's'}.`,
        { variant: 'success' }
      );

      // Label Status tracking: only a real batch counts as "printed" -- a
      // test sheet is explicitly for checking alignment before committing
      // label stock, not a record that the item's real label went out.
      // mark_labels_printed sets label_printed_at server-side with now(),
      // not a client timestamp passed to .update() -- trg_inventory_items_
      // updated_at also stamps updated_at = now() on the same row in the
      // same statement, and now() is transaction-stable in Postgres (one
      // value for the whole transaction), so both columns land on the
      // identical instant instead of updated_at racing a few ms ahead of a
      // client-supplied value and showing "Needs Update" the moment a label
      // is printed. Best-effort: the PDF is already saved locally at this
      // point either way, so a failed status update shouldn't read as a
      // failed print.
      if (!testOnly && toPrint.length > 0) {
        const printedIds = toPrint.map((i) => i.id);
        const { error: stampError } = await supabase.rpc('mark_labels_printed', { p_ids: printedIds });
        if (!stampError) {
          // Optimistic local echo: set both fields to the same client-side
          // instant so labelStatus() reads 'printed' immediately without a
          // refetch -- the authoritative DB values (both server-side now())
          // are already correct regardless of this local approximation.
          const now = new Date().toISOString();
          const printedIdSet = new Set(printedIds);
          setItems((prev) =>
            prev.map((i) => (printedIdSet.has(i.id) ? { ...i, label_printed_at: now, updated_at: now } : i))
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF.';
      setError(message);
      showToast('Failed to generate PDF.', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <SkeletonList rows={5} />;

  const photoCount = items.filter((i) => i.photo_url && isDirectImageUrl(i.photo_url)).length;

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Print Item Labels</h1>
      <p className="text-sm text-dusk mb-1">
        Avery 22807 (2"×2" squares) · 20 labels per sheet · one label per item, with photo where available.
      </p>
      {items.length > 0 && (
        <p className="text-xs text-dusk mb-4">
          {photoCount} of {items.length} items have a usable photo — the rest print QR + name only.
        </p>
      )}

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        {/* Filters panel */}
        <div className="bg-white rounded-2xl shadow-sm shadow-black/5 p-4 mb-4 lg:mb-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-brass">Filters</h2>
            {(search || locationFilter || photosOnly || lowStockOnly || categoryFilter || labelStatusFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setLocationFilter(null);
                  setPhotosOnly(false);
                  setLowStockOnly(false);
                  setCategoryFilter(null);
                  setLabelStatusFilter(null);
                }}
                className="text-xs text-brass underline"
              >
                Clear
              </button>
            )}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full border border-cardBorder rounded-full px-3 py-2 text-sm"
          />
          <select
            value={locationFilter ?? ''}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className="w-full border border-cardBorder rounded-full px-3 py-2 text-sm"
          >
            <option value="">All locations</option>
            {locations
              .filter((loc) => locationOptions.has(loc.id))
              .map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({locationOptions.get(loc.id)})
                </option>
              ))}
          </select>

          <div className="flex rounded-full border border-cardBorder overflow-hidden text-[10px] font-semibold uppercase tracking-[0.15em]">
            <button
              onClick={() => handleSortModeChange('macro')}
              className={`flex-1 py-1.5 ${sortMode === 'macro' ? 'bg-denim text-white' : 'bg-linen text-dusk'}`}
            >
              Broad
            </button>
            <button
              onClick={() => handleSortModeChange('micro')}
              className={`flex-1 py-1.5 ${sortMode === 'micro' ? 'bg-denim text-white' : 'bg-linen text-dusk'}`}
            >
              Detailed
            </button>
          </div>
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="w-full border border-cardBorder rounded-full px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categoryOptions.map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </select>

          <label className={`flex items-center justify-between text-sm text-denim ${!photosOnly && photosOnlyCount === 0 ? 'opacity-40' : ''}`}>
            <span>Only items with photos {!photosOnly && <span className="text-dusk">({photosOnlyCount})</span>}</span>
            <input
              type="checkbox"
              checked={photosOnly}
              disabled={!photosOnly && photosOnlyCount === 0}
              onChange={(e) => setPhotosOnly(e.target.checked)}
              className="h-4 w-4 accent-brass rounded disabled:cursor-not-allowed"
            />
          </label>
          <label className={`flex items-center justify-between text-sm text-denim ${!lowStockOnly && lowStockOnlyCount === 0 ? 'opacity-40' : ''}`}>
            <span>Low stock only {!lowStockOnly && <span className="text-dusk">({lowStockOnlyCount})</span>}</span>
            <input
              type="checkbox"
              checked={lowStockOnly}
              disabled={!lowStockOnly && lowStockOnlyCount === 0}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="h-4 w-4 accent-brass rounded disabled:cursor-not-allowed"
            />
          </label>

          <div>
            <p className="text-sm text-denim mb-1.5">Label status</p>
            {/* Cross-narrowing applies here too: All is always live (it's
                the union), and whichever status is currently active stays
                clickable so you can back out of it, but a status with zero
                matches given everything else selected is disabled rather
                than sitting there as a dead end. */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <button
                onClick={() => setLabelStatusFilter(null)}
                className={`flex items-center gap-1 ${labelStatusFilter === null ? 'text-brass font-medium' : 'text-dusk'}`}
              >
                {labelStatusFilter === null && <span className="w-1.5 h-1.5 rounded-full bg-denim" aria-hidden="true" />}
                All
              </button>
              {(Object.keys(LABEL_STATUS_TEXT) as LabelStatus[]).map((s) => {
                const count = labelStatusCounts[s];
                const disabled = labelStatusFilter !== s && count === 0;
                return (
                  <button
                    key={s}
                    onClick={() => setLabelStatusFilter(s)}
                    disabled={disabled}
                    className={`flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                      labelStatusFilter === s ? 'text-brass font-medium' : 'text-dusk'
                    }`}
                  >
                    {labelStatusFilter === s && <span className="w-1.5 h-1.5 rounded-full bg-denim" aria-hidden="true" />}
                    {LABEL_STATUS_TEXT[s]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm text-denim mb-1.5">Label language</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLabelLanguage('en')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium border ${
                  labelLanguage === 'en' ? 'bg-denim text-white border-denim' : 'bg-linen text-denim border-cardBorder'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLabelLanguage('es')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium border ${
                  labelLanguage === 'es' ? 'bg-denim text-white border-denim' : 'bg-linen text-denim border-cardBorder'
                }`}
              >
                Español
              </button>
            </div>
          </div>
        </div>

        {/* Items panel — deduplicated by name */}
        <div className="mb-4 lg:mb-0">
          <div className="flex items-center justify-end gap-3 mb-2 text-xs flex-wrap">
            {/* What the page used to do to you on arrival, now offered as a
                choice. Hidden entirely when nothing is flagged rather than
                shown as a dead "Load 0". */}
            {flaggedIds.length > 0 && (
              <button
                onClick={loadFlagged}
                // Solid primary fill, no border -- SS-297. The ticket named
                // bg-denimBlue, but that is the logged-out/auth CTA colour
                // (AuthSubmitButton, the marketing pages, LocaleToggle --
                // all 4 of its uses). Inside the product it is bg-denim:
                // 198 uses, D-18 states it outright ("selected state is
                // bg-denim with white text"), and Generate PDF at the
                // bottom of THIS page is already bg-denim. denimBlue here
                // would have clashed with the primary button directly below
                // it. One token away if that was actually intended.
                className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-denim px-3 py-1.5 font-medium text-white hover:opacity-90 transition-opacity"
              >
                Load {flaggedIds.length} items flagged for printing
              </button>
            )}
            <button onClick={() => selectAll(true)} className="text-denim underline">
              Select all
            </button>
            <button onClick={() => selectAll(false)} className="text-denim underline">
              Clear
            </button>
          </div>

          {/* Virtualized: a real per-keystroke lag existed here before this
              (measured live: ~240ms per filter keystroke re-rendering all
              592 real distinct-name rows, well past the ~16ms budget for
              smooth typing) -- only the rows actually visible in the 50vh
              viewport are ever mounted now, regardless of list length. */}
          {groupedItems.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm shadow-black/5 overflow-hidden h-[50vh]">
              <List
                rowComponent={VirtualGroupRow}
                rowCount={groupedItems.length}
                rowHeight={48}
                rowProps={{ groups: groupedItems, selected, onToggle: toggleGroup }}
                style={{ height: '100%' }}
              />
            </div>
          )}

          {groupedItems.length === 0 && (
            <div className="text-center mt-8">
              {items.length === 0 ? (
                <>
                  <p className="text-sm text-dusk mb-2">No items yet.</p>
                  <Link href={`/properties/${propertyId}/inventory`} className="text-sm font-medium text-brass underline">
                    Add items in Inventory →
                  </Link>
                </>
              ) : (
                <p className="text-sm text-dusk">No items match these filters.</p>
              )}
            </div>
          )}
        </div>

        {/* Live preview panel — scaled approximation of the real Avery
            22807 sheet, first page only. Not a pixel-perfect PDF render;
            generatePdf() below is still the source of truth for the
            actual output. */}
        <div className="bg-white rounded-2xl shadow-sm shadow-black/5 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-3">
            Live Preview {selectedItems.length > 20 && `(page 1 of ${Math.ceil(selectedItems.length / 20)})`}
          </h2>
          <div className="grid grid-cols-4 gap-1 bg-linen p-2 rounded-lg border border-cardBorder">
            {Array.from({ length: 20 }).map((_, i) => {
              const item = selectedItems[i];
              const hasPhoto = !!item && !!item.photo_url && isDirectImageUrl(item.photo_url);
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-sm flex flex-col items-center justify-center p-0.5 overflow-hidden ${
                    item
                      ? hasPhoto
                        ? 'border border-cardBorder bg-white'
                        // Previously bg-linen inside a bg-linen
                        // container -- computed the actual blended colors:
                        // that left about a 1-2 unit RGB difference from
                        // the container, functionally invisible. This
                        // gold-light/40 + gold-dark/50 border blends to a
                        // real ~10-20 unit difference from both the
                        // container and the white has-photo cells --
                        // genuinely visible at a glance, still just the
                        // gold family, no new color introduced.
                        : 'border border-dashed border-denim/50 bg-linen'
                      : 'border border-cardBorder bg-white'
                  }`}
                >
                  {item ? (
                    <>
                      {/* The real photo, not a camera emoji standing in for
                          one. A preview whose job is "check this before
                          committing to N sheets" has to show what actually
                          prints. Requested at 96px for a cell well under
                          that: these are full-size inventory photos, and 20
                          of them unresized is megabytes to fill a grid of
                          thumbnails (see lib/storage-image.ts). */}
                      {hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={storageThumbnail(item.photo_url!, 96)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          // Spec said w-full h-full. That is a flex column
                          // with a name span under it, so h-full would push
                          // the name out of an overflow-hidden cell --
                          // and the brief says the name stays as-is.
                          // flex-1 min-h-0 fills the space above the name
                          // instead of all of it. Same intent, both visible.
                          className="flex-1 min-h-0 w-full object-cover rounded-sm"
                        />
                      ) : (
                        <span className="text-[10px] leading-none">🏷️</span>
                      )}
                      <span className="text-[6px] leading-tight text-center text-dusk line-clamp-2 mt-0.5">
                        {truncateForLabel(labelName(item, labelLanguage))}
                      </span>
                    </>
                  ) : (
                    <span className="text-[8px] text-dusk">—</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-dusk mt-2">{selectedItems.length} label{selectedItems.length === 1 ? '' : 's'} selected</p>
        </div>
      </div>

      {/* Sticky footer: bottom-16 on mobile clears MobileBottomNav (fixed
          bottom-0, md:hidden); bottom-2 on desktop where that bar doesn't
          exist. Lets the count/chip panel and Generate PDF stay reachable
          without scrolling back down through a long virtualized list. */}
      <div className="sticky bottom-16 md:bottom-2 z-20 mt-4 space-y-2">
        {showSelectionPanel && selectedGroups.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md shadow-black/10 border border-cardBorder p-3 max-h-56 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {selectedGroups.map((group) => (
                <button
                  key={group.name}
                  onClick={() => toggleGroup(group.items)}
                  className="inline-flex items-center gap-1.5 text-xs bg-linen text-denim pl-2.5 pr-2 py-1 rounded-full hover:bg-linen transition"
                >
                  <span className="truncate max-w-[10rem]">{group.name}</span>
                  {group.items.length > 1 && (
                    <span className="text-dusk shrink-0">×{group.items.length}</span>
                  )}
                  <span aria-hidden="true" className="text-dusk shrink-0">
                    ✕
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Second, louder guardrail above a batch nobody prints by
            accident. The 50-sheet notice below is informational -- it tells
            you the count and offers a test sheet. This one is a warning: at
            this size the likeliest explanation is that a filter was meant
            to be applied and wasn't, so it says what to do rather than just
            how big the number is. Rust, and it sits above the other one.
            Threshold is a single constant -- move it if 100 is wrong. */}
        {selected.size > LARGE_BATCH_WARNING && (
          <div className="bg-rust/10 border border-rust/30 rounded-2xl px-4 py-2.5 text-xs text-rust">
            That&apos;s {Math.ceil(selected.size / 20)}+ sheets — filter by location first.
          </div>
        )}

        {/* Guardrail: only past a real batch size, not for a handful of
            labels where a misclick can't do much damage. */}
        {selected.size > 50 && (
          <div className="bg-linen border border-cardBorder rounded-2xl px-4 py-2 text-xs text-denim flex items-center justify-between gap-3 flex-wrap">
            <span>
              {selected.size} labels = {Math.ceil(selected.size / 20)} sheets of Avery 22807
            </span>
            <button
              onClick={() => generatePdf(true)}
              disabled={generating}
              className="shrink-0 text-xs font-medium text-brass underline disabled:opacity-40"
            >
              Print 1 test sheet
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md shadow-black/10 border border-cardBorder p-3 flex items-center gap-3">
          <button
            onClick={() => setShowSelectionPanel((v) => !v)}
            disabled={selected.size === 0}
            className="text-sm text-denim underline shrink-0 disabled:opacity-40 disabled:no-underline"
          >
            {selected.size} selected
          </button>
          <button
            onClick={() => generatePdf(false)}
            disabled={generating || selected.size === 0}
            className="flex-1 py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40 text-sm"
          >
            {generating ? 'Generating…' : `Generate PDF (${selected.size} labels)`}
          </button>
        </div>
      </div>
    </div>
  );
}

type GroupedItem = { name: string; items: Item[] };

function VirtualGroupRow({
  index,
  style,
  ariaAttributes,
  groups,
  selected,
  onToggle,
}: RowComponentProps<{
  groups: GroupedItem[];
  selected: Set<string>;
  onToggle: (groupItems: Item[]) => void;
}>) {
  const group = groups[index];
  const checkboxRef = useRef<HTMLInputElement>(null);
  const selectedCount = group.items.filter((i) => selected.has(i.id)).length;
  const allSelected = selectedCount === group.items.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const hasPhoto = group.items.some((i) => i.photo_url && isDirectImageUrl(i.photo_url));

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div
      {...ariaAttributes}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 ${index < groups.length - 1 ? 'border-b border-cardBorder' : ''}`}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={() => onToggle(group.items)}
        className="h-5 w-5 accent-brass rounded"
      />
      <span className="flex-1 text-denim truncate">{group.name}</span>
      {group.items.length > 1 && (
        <span className="text-xs text-dusk shrink-0">×{group.items.length}</span>
      )}
      {hasPhoto && <span className="text-xs text-sage shrink-0">📷</span>}
    </div>
  );
}
