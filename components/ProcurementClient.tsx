// components/ProcurementClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { LogoMark } from '@/components/Logo';
import WhatsAppIcon from '@/components/WhatsAppIcon';

// The household/property-count rule (SS-359) is applied once, server-side,
// in app/procurement/page.tsx, where the household's real property count is
// known -- this component just renders whatever label it's given.
// SS-853: `name` is the bare properties.name -- v_low_stock_summary has no
// property_id column at all (it groups by name/city/state/store), so this
// is what the Low Stock cards match against to build a real href.
type Property = { id: string; name: string; label: string };

type LowStockSummaryRow = {
  property: string;
  location: string;
  store: string | null;
  items_low: number;
  never_counted: number;
  total_items: number;
};

type RawItem = {
  id: string;
  name: string;
  category: string | null;
  qty_needed: number;
  status: 'pending' | 'purchased';
  property_id: string;
  property_name: string;
  photo_url: string | null;
};

type StitchedItem = {
  key: string;
  displayName: string;
  category: string | null;
  totalQty: number;
  fromProperties: { propertyId: string; propertyName: string; qty: number }[];
  itemIds: string[];
  allPurchased: boolean;
  photoUrl: string | null;
};

const UNCATEGORIZED = 'Uncategorized';
const AISLE_ORDER = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Frozen',
  'Pantry', 'Paper Goods', 'Cleaners', 'Personal Care', UNCATEGORIZED,
];

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function stitchItems(raw: RawItem[]): StitchedItem[] {
  const groups = new Map<string, StitchedItem>();
  for (const item of raw) {
    const key = normalizeName(item.name);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        displayName: item.name,
        category: item.category,
        totalQty: 0,
        fromProperties: [],
        itemIds: [],
        allPurchased: true,
        photoUrl: null,
      });
    }
    const group = groups.get(key)!;
    group.totalQty += item.qty_needed;
    group.itemIds.push(item.id);
    if (item.status !== 'purchased') group.allPurchased = false;
    // SS-854: render the photo when it exists, honest absence otherwise --
    // first one found wins, since every stitched row shares one thumbnail
    // regardless of which house's copy supplied it.
    if (item.photo_url && !group.photoUrl) group.photoUrl = item.photo_url;

    const existingProp = group.fromProperties.find((p) => p.propertyId === item.property_id);
    if (existingProp) {
      existingProp.qty += item.qty_needed;
    } else {
      group.fromProperties.push({
        propertyId: item.property_id,
        propertyName: item.property_name,
        qty: item.qty_needed,
      });
    }
  }
  return [...groups.values()];
}

function groupByCategory(items: StitchedItem[]) {
  const groups = new Map<string, StitchedItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const ai = AISLE_ORDER.indexOf(a);
    const bi = AISLE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function ProcurementClient({
  properties,
  errorMessage,
}: {
  properties: Property[];
  errorMessage?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(properties.map((p) => p.id)));
  const [rawItems, setRawItems] = useState<RawItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(errorMessage ?? null);
  const [hidePurchased, setHidePurchased] = useState(false);
  const [lowStockSummary, setLowStockSummary] = useState<LowStockSummaryRow[] | null>(null);

  const supabase = createClient();
  const showToast = useToast();
  const locale = useLocale();
  const es = locale === 'es';

  // "Low in both houses" is not "buy for both" -- the family is in one
  // property at a time and each house's links point at its own store
  // (Main -> Kosher West, Country -> Gourmet Glatt). This is a side-by-side
  // per-property comparison, not a merged list -- v_low_stock_summary is
  // already grouped by property, one row each, nothing stitched together.
  useEffect(() => {
    supabase
      .from('v_low_stock_summary')
      .select('*')
      .then(({ data }) => setLowStockSummary((data as LowStockSummaryRow[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SS-853: the view groups by properties.name and carries no id of its
  // own -- matched back to a real property here so the card can link
  // somewhere instead of being a dead tile.
  const propertyIdByName = useMemo(() => new Map(properties.map((p) => [p.name, p.id])), [properties]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const selected = properties.filter((p) => selectedIds.has(p.id));

    const results = await Promise.all(
      selected.map(async (property) => {
        const { data: list } = await supabase
          .from('shopping_lists')
          .select('id')
          .eq('property_id', property.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!list) return [];

        // SS-854: item photos were never asked for -- Main/Country/Lax
        // already have them on 77-82% of items, unjoined, not missing.
        const { data: items } = await supabase
          .from('shopping_list_items')
          .select('id, name, category, qty_needed, status, inventory_items(photo_url)')
          .eq('shopping_list_id', list.id);

        return (items ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          qty_needed: i.qty_needed,
          status: i.status,
          property_id: property.id,
          property_name: property.label,
          photo_url: (i.inventory_items as unknown as { photo_url: string | null } | null)?.photo_url ?? null,
        })) as RawItem[];
      })
    );

    setRawItems(results.flat());
    setLoading(false);
  }, [properties, selectedIds, supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stitched = useMemo(() => stitchItems(rawItems), [rawItems]);
  const visible = hidePurchased ? stitched.filter((i) => !i.allPurchased) : stitched;
  const grouped = useMemo(() => groupByCategory(visible), [visible]);

  // How many properties the *remaining* items actually come from -- not
  // how many properties are toggled on. selectedIds.size answers "how many
  // chips are lit," which reads as real distribution ("79 items across 4
  // properties") even when 3 of those 4 have nothing pending -- confirmed
  // live on Low/Lax, both selected but with zero inventory_items, so every
  // one of the 79 came from Main alone.
  const remainingItems = stitched.filter((i) => !i.allPurchased);
  const propertiesWithRemainingItems = useMemo(
    () => new Set(remainingItems.flatMap((i) => i.fromProperties.map((p) => p.propertyId))).size,
    [remainingItems]
  );

  function toggleProperty(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markGroupPurchased(group: StitchedItem, purchased: boolean) {
    const nextStatus = purchased ? 'purchased' : 'pending';
    // Optimistic — update every underlying row across every property at once.
    setRawItems((prev) =>
      prev.map((i) => (group.itemIds.includes(i.id) ? { ...i, status: nextStatus } : i))
    );

    const results = await Promise.all(
      group.itemIds.map((id) =>
        resilientUpdate(supabase, 'shopping_list_items', { id }, { status: nextStatus })
      )
    );

    if (results.some((r) => !r.ok)) {
      showToast('Some items failed to update.', { variant: 'error' });
      loadAll();
    } else if (results.some((r) => r.queued)) {
      showToast('Saved — will sync when back online.');
    }
  }

  // SS-855/SS-014: same wa.me pattern ShoppingListViewEnhanced already
  // uses for a single house, extended to the cross-house grouping this
  // page already builds for print -- the list a reader gets is the same
  // one they'd have printed, in their own language.
  function shareWhatsApp() {
    const weekOf = new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric' });
    const heading = es ? `*Compras, semana del ${weekOf}*` : `*Shopping, week of ${weekOf}*`;
    let text = `${heading}\n`;
    for (const [category, items] of groupByCategory(remainingItems)) {
      text += `\n_${category}_\n`;
      for (const item of items) {
        text += `- ${item.displayName} (${item.totalQty})\n`;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-mist">
      {/* SS-257: this header and app/procurement/layout.tsx's AppHeader
          were both `sticky top-0 z-30` -- identical positioning, so on
          scroll they fought for the same spot instead of stacking, and
          whichever painted second clipped the other. AppHeader (added by
          SS-126 for the "no header, stranded" fix) sits above this one in
          the DOM and is the taller, primary chrome -- top-[60px] sticks
          this one directly beneath it instead of on top of it, same
          pattern app/properties/[id]/layout.tsx already uses for the
          property nav bar stacked under the same AppHeader. z-20, not 30,
          so AppHeader always wins if they ever do overlap during the
          sticky transition. */}
      <header className="flex items-center justify-between px-4 py-3 bg-denim text-white sticky top-[60px] z-20 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* SS-021: Procurement isn't scoped to a single property (it
              combines shopping across several), so there's no one dashboard
              to send this to -- links to the properties picker instead,
              same destination as this header's own "Properties" link below. */}
          <Link href="/properties" className="flex items-center gap-2.5 shrink-0">
            <LogoMark className="w-9 h-9" />
          </Link>
          <span className="font-display text-lg">Shop All Houses</span>
        </div>
        <Link href="/properties" className="text-sm text-white/70 hover:text-white">
          ← Properties
        </Link>
      </header>

      <main className="max-w-md lg:max-w-4xl mx-auto p-4 print:max-w-full">
        <div className="hidden print:block mb-4">
          <h1 className="font-display text-2xl text-denim">Combined Shopping Trip</h1>
          <p className="text-sm text-dusk">
            {properties
              .filter((p) => selectedIds.has(p.id))
              .map((p) => p.label)
              .join(', ')}{' '}
            —{' '}
            {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* SS-855: one dominant element instead of five equal cards --
            SS-853 turns each into a real link, so the card itself is now
            the affordance, not a decoration beside one. grid-cols-3 fits
            the live 6-property set with no orphan cell (the empty slot
            beside Main at 2-up was the largest hole on the page). */}
        {lowStockSummary && lowStockSummary.length > 0 && (
          <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-4 print:hidden">
            <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-3">Low Stock by Property</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lowStockSummary.map((row) => {
                const propertyId = propertyIdByName.get(row.property);
                const content = (
                  <>
                    <p className="font-display text-lg text-denim">{row.property}</p>
                    <p className="text-[11px] text-dusk mb-1.5">{row.location} · {row.store ?? 'No store set'}</p>
                    <p className="text-2xl font-display text-rust leading-none">{row.items_low}</p>
                    <p className="text-[11px] text-dusk">of {row.total_items} items low</p>
                  </>
                );
                // SS-853: was a bare div, no href at all. Falls back to the
                // static tile (rather than a link to nowhere) only if this
                // property's id genuinely can't be resolved -- shouldn't
                // happen since both sides come from the same properties
                // list, but a card that can't build a real href must not
                // pretend to be a link.
                return propertyId ? (
                  <Link
                    key={row.property}
                    href={`/properties/${propertyId}/inventory?lowStock=1`}
                    className="bg-mist rounded-xl2 px-3 py-2.5 hover:shadow-cardHover transition-shadow"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={row.property} className="bg-mist rounded-xl2 px-3 py-2.5">
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-5 print:hidden">
          <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-2">Include properties</h2>
          <div className="flex flex-wrap gap-2">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProperty(p.id)}
                className={
                  selectedIds.has(p.id)
                    ? 'px-3 py-1.5 rounded-full text-sm bg-denim text-white'
                    : 'px-3 py-1.5 rounded-full text-sm bg-mist border border-cardBorder text-denim'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-rust bg-rust/10 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        {loading ? (
          <SkeletonList />
        ) : stitched.length === 0 ? (
          <p className="text-sm text-dusk text-center mt-8">
            Nothing on any selected property's list right now.
          </p>
        ) : (
          // SS-855: vertical rhythm -- space BETWEEN category sections
          // (gap-6) now visibly exceeds space WITHIN one (the divide-y
          // rows below), which was the same mb-4 as everything else on
          // the page and read as flat.
          <div className="lg:columns-2 lg:gap-4 [&>*]:mb-6">
            {grouped.map(([category, items]) => (
              <section key={category} className="break-inside-avoid print:break-inside-avoid">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass px-1 mb-2">
                  {category}
                </h3>
                <ul className="divide-y divide-cardBorder rounded-2xl bg-card border border-cardBorder shadow-card overflow-hidden print:shadow-none print:border print:border-cardBorder">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-3 px-4 py-3 print:py-1.5">
                      <input
                        type="checkbox"
                        checked={item.allPurchased}
                        onChange={(e) => markGroupPurchased(item, e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-denim rounded print:hidden"
                      />
                      <span className="hidden print:inline text-dusk shrink-0">☐</span>
                      {/* SS-854: the thumbnail per row -- most of the
                          aesthetic pass in one element. No placeholder
                          when there's genuinely no photo (SS-854's honest
                          empty state), the row just sits one column
                          narrower. */}
                      {item.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoUrl}
                          alt=""
                          loading="lazy"
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-mist print:hidden"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {/* SS-855: item name leads (was tied with qty at
                            the same size); quantity reads as a numeral
                            badge, not competing body text. */}
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`font-display text-[15px] truncate ${
                              item.allPurchased ? 'line-through text-dusk' : 'text-denim'
                            }`}
                          >
                            {item.displayName}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-brass bg-brass/10 rounded-full px-2 py-0.5">
                            {item.totalQty}
                          </span>
                        </div>
                        {/* House chips recede -- smaller and mist-only, no
                            border competing with the qty badge above. */}
                        {item.fromProperties.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.fromProperties.map((p) => (
                              <span
                                key={p.propertyId}
                                className="text-[10px] text-dusk bg-mist px-1.5 py-0.5 rounded-full"
                              >
                                {p.propertyName}: {p.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* SS-855: the action row moves to the bottom and carries the page
            now -- it sat mid-page, above the content it governs, before
            this. Item count, Hide picked up, Print, and the WhatsApp
            share SS-014 asked for. */}
        {!loading && stitched.length > 0 && (
          <div className="flex items-center justify-between mt-6 px-1 print:hidden">
            <span className="text-sm text-dusk">
              {remainingItems.length} items left across{' '}
              {propertiesWithRemainingItems} propert{propertiesWithRemainingItems === 1 ? 'y' : 'ies'}
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-dusk">
                <input
                  type="checkbox"
                  checked={hidePurchased}
                  onChange={(e) => setHidePurchased(e.target.checked)}
                  className="accent-denim"
                />
                Hide picked up
              </label>
              <button
                onClick={shareWhatsApp}
                className="flex items-center gap-1.5 text-sm font-medium text-denim hover:text-brass px-2 py-1 rounded-full transition-colors"
              >
                <WhatsAppIcon size={16} />
                Share
              </button>
              <button
                onClick={() => window.print()}
                className="text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full"
              >
                🖨️ Print
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
