// components/PrintLabelsClient.tsx
// Requires: npm install jspdf qrcode
// Rebuilt per direct feedback: labels are now per INVENTORY ITEM (with photo),
// not per storage location. Layout: Avery 22807 (20 labels/sheet, 4x5 grid of 2"×2" squares).
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { List, type RowComponentProps } from 'react-window';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { SITE_URL } from '@/lib/site-url';

type Item = {
  id: string;
  name: string;
  qr_code: string;
  photo_url: string | null;
  print_label: boolean;
  location_id: string | null;
};

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
function truncateForLabel(name: string): string {
  return name.length > MAX_LABEL_NAME_LENGTH ? name.slice(0, MAX_LABEL_NAME_LENGTH - 1) + '…' : name;
}

export default function PrintLabelsClient({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    Promise.all([
      supabase
        .from('inventory_items')
        .select('id, name, qr_code, photo_url, print_label, location_id')
        .eq('property_id', propertyId)
        .order('name'),
      supabase.from('locations').select('id, name').eq('property_id', propertyId).order('name'),
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
      // Respect each item's Print Label toggle (set in the Edit Item
      // modal) as the initial selection — still fully overridable below.
      setSelected(new Set(data.filter((i) => i.print_label).map((i) => i.id)));
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
    setSelected(value ? new Set(items.map((i) => i.id)) : new Set());
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (locationFilter && i.location_id !== locationFilter) return false;
      if (photosOnly && !(i.photo_url && isDirectImageUrl(i.photo_url))) return false;
      return true;
    });
  }, [items, search, locationFilter, photosOnly]);

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

  async function generatePdf() {
    setGenerating(true);
    setError(null);
    try {
      const toPrint = items.filter((i) => selected.has(i.id));
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      const t = AVERY_22807;
      const perPage = t.cols * t.rows;

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

        // Item name at bottom-right of QR
        doc.setFontSize(7);
        doc.setTextColor(0);
        const nameX = x + qrSize + 0.18;
        const nameY = y + t.labelHeight - 0.3;
        // jsPDF's maxWidth wraps rather than clips — a long name would wrap
        // onto extra lines and bleed past the label's physical edge instead
        // of staying on one line, so truncate explicitly first.
        doc.text(truncateForLabel(item.name), nameX, nameY, { maxWidth: t.labelWidth - qrSize - 0.3 });

        // Human-readable code below name — a fallback for when a QR won't scan
        doc.setFontSize(4.5);
        doc.setTextColor(150);
        doc.text(item.qr_code, nameX, y + t.labelHeight - 0.08, {
          maxWidth: t.labelWidth - qrSize - 0.3,
        });
        doc.setTextColor(0);
      }

      doc.save(`item-labels-${propertyId}.pdf`);
      showToast(`Generated ${toPrint.length} label${toPrint.length === 1 ? '' : 's'}.`, {
        variant: 'success',
      });
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
      <h1 className="text-2xl font-display text-charcoal mb-1">Print Item Labels</h1>
      <p className="text-sm text-charcoal/50 mb-1">
        Avery 22807 (2"×2" squares) · 20 labels per sheet · one label per item, with photo where available.
      </p>
      {items.length > 0 && (
        <p className="text-xs text-charcoal/40 mb-4">
          {photoCount} of {items.length} items have a usable photo — the rest print QR + name only.
        </p>
      )}

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        {/* Filters panel */}
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-4 lg:mb-0 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark">Filters</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full border border-gold-light/60 rounded-full px-3 py-2 text-sm"
          />
          <select
            value={locationFilter ?? ''}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className="w-full border border-gold-light/60 rounded-full px-3 py-2 text-sm"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <label className="flex items-center justify-between text-sm text-charcoal">
            <span>Only items with photos</span>
            <input
              type="checkbox"
              checked={photosOnly}
              onChange={(e) => setPhotosOnly(e.target.checked)}
              className="h-4 w-4 accent-gold-dark rounded"
            />
          </label>
        </div>

        {/* Items panel — deduplicated by name */}
        <div className="mb-4 lg:mb-0">
          <div className="flex justify-end gap-3 mb-2 text-xs">
            <button onClick={() => selectAll(true)} className="text-charcoal underline">
              Select all
            </button>
            <button onClick={() => selectAll(false)} className="text-charcoal underline">
              Clear
            </button>
          </div>

          {/* Virtualized: a real per-keystroke lag existed here before this
              (measured live: ~240ms per filter keystroke re-rendering all
              592 real distinct-name rows, well past the ~16ms budget for
              smooth typing) -- only the rows actually visible in the 50vh
              viewport are ever mounted now, regardless of list length. */}
          {groupedItems.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden h-[50vh]">
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
            <p className="text-sm text-charcoal/40 text-center mt-8">
              {items.length === 0 ? 'No items yet — add some in Inventory first.' : 'No items match these filters.'}
            </p>
          )}
        </div>

        {/* Live preview panel — scaled approximation of the real Avery
            22807 sheet, first page only. Not a pixel-perfect PDF render;
            generatePdf() below is still the source of truth for the
            actual output. */}
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-3">
            Live Preview {selectedItems.length > 20 && `(page 1 of ${Math.ceil(selectedItems.length / 20)})`}
          </h2>
          <div className="grid grid-cols-4 gap-1 bg-cream/60 p-2 rounded-lg border border-gold-light/40">
            {Array.from({ length: 20 }).map((_, i) => {
              const item = selectedItems[i];
              return (
                <div
                  key={i}
                  className="aspect-square border border-gold-light/50 rounded-sm bg-white flex flex-col items-center justify-center p-0.5 overflow-hidden"
                >
                  {item ? (
                    <>
                      <span className="text-[10px] leading-none">
                        {item.photo_url && isDirectImageUrl(item.photo_url) ? '📷' : '🏷️'}
                      </span>
                      <span className="text-[6px] leading-tight text-center text-charcoal/70 line-clamp-2 mt-0.5">
                        {truncateForLabel(item.name)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[8px] text-charcoal/15">—</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-charcoal/40 mt-2">{selectedItems.length} label{selectedItems.length === 1 ? '' : 's'} selected</p>
        </div>
      </div>

      <button
        onClick={generatePdf}
        disabled={generating || selected.size === 0}
        className="w-full py-3 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40 mt-4"
      >
        {generating ? 'Generating…' : `Generate PDF (${selected.size} labels)`}
      </button>
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
      className={`flex items-center gap-3 px-4 py-3 ${index < groups.length - 1 ? 'border-b border-gold-light/30' : ''}`}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={() => onToggle(group.items)}
        className="h-5 w-5 accent-gold rounded"
      />
      <span className="flex-1 text-charcoal truncate">{group.name}</span>
      {group.items.length > 1 && (
        <span className="text-xs text-charcoal/40 shrink-0">×{group.items.length}</span>
      )}
      {hasPhoto && <span className="text-xs text-sage shrink-0">📷</span>}
    </div>
  );
}
