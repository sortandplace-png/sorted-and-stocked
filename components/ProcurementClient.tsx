// components/ProcurementClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { LogoMark } from '@/components/Logo';

type Property = { id: string; name: string };

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
};

type StitchedItem = {
  key: string;
  displayName: string;
  category: string | null;
  totalQty: number;
  fromProperties: { propertyId: string; propertyName: string; qty: number }[];
  itemIds: string[];
  allPurchased: boolean;
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
      });
    }
    const group = groups.get(key)!;
    group.totalQty += item.qty_needed;
    group.itemIds.push(item.id);
    if (item.status !== 'purchased') group.allPurchased = false;

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

        const { data: items } = await supabase
          .from('shopping_list_items')
          .select('id, name, category, qty_needed, status')
          .eq('shopping_list_id', list.id);

        return (items ?? []).map((i) => ({
          ...i,
          property_id: property.id,
          property_name: property.name,
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

  return (
    <div className="min-h-screen bg-mist">
      <header className="flex items-center justify-between px-4 py-3 bg-denim text-white sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* SS-021: Procurement isn't scoped to a single property (it
              combines shopping across several), so there's no one dashboard
              to send this to -- links to the properties picker instead,
              same destination as this header's own "Properties" link below. */}
          <Link href="/properties" className="flex items-center gap-2.5 shrink-0">
            <LogoMark className="w-9 h-9" />
          </Link>
          <span className="font-display text-lg">Procurement</span>
        </div>
        <Link href="/properties" className="text-sm text-white/70 hover:text-white">
          ← Properties
        </Link>
      </header>

      <main className="max-w-md lg:max-w-4xl mx-auto p-4 print:max-w-full">
        <div className="hidden print:block mb-4">
          <h1 className="font-display text-2xl text-denim">Combined Shopping Trip</h1>
          <p className="text-sm text-dusk">
            {properties.filter((p) => selectedIds.has(p.id)).map((p) => p.name).join(', ')} —{' '}
            {new Date().toLocaleDateString()}
          </p>
        </div>

        {lowStockSummary && lowStockSummary.length > 0 && (
          <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-4 print:hidden">
            <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-3">Low Stock by Property</h2>
            <div className="grid grid-cols-2 gap-3">
              {lowStockSummary.map((row) => (
                <div key={row.property} className="bg-mist rounded-xl2 px-3 py-2.5">
                  <p className="font-display text-lg text-denim">{row.property}</p>
                  <p className="text-[11px] text-dusk mb-1.5">{row.location} · {row.store ?? 'No store set'}</p>
                  <p className="text-2xl font-display text-rust leading-none">{row.items_low}</p>
                  <p className="text-[11px] text-dusk">of {row.total_items} items low</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-4 print:hidden">
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
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-rust bg-rust/10 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <div className="flex items-center justify-between mb-3 px-1 print:hidden">
          <span className="text-sm text-dusk">
            {stitched.filter((i) => !i.allPurchased).length} items left across{' '}
            {selectedIds.size} propert{selectedIds.size === 1 ? 'y' : 'ies'}
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
              onClick={() => window.print()}
              className="text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonList />
        ) : stitched.length === 0 ? (
          <p className="text-sm text-dusk text-center mt-8">
            Nothing on any selected property's list right now.
          </p>
        ) : (
          <div className="lg:columns-2 lg:gap-4">
            {grouped.map(([category, items]) => (
              <section key={category} className="mb-4 break-inside-avoid print:break-inside-avoid">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass px-1 mb-2">
                  {category}
                </h3>
                <ul className="divide-y divide-cardBorder rounded-2xl bg-card border border-cardBorder shadow-card overflow-hidden print:shadow-none print:border print:border-cardBorder">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-start gap-3 px-4 py-3 print:py-1.5">
                      <input
                        type="checkbox"
                        checked={item.allPurchased}
                        onChange={(e) => markGroupPurchased(item, e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-denim rounded mt-0.5 print:hidden"
                      />
                      <span className="hidden print:inline text-dusk shrink-0">☐</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={
                              item.allPurchased ? 'line-through text-dusk' : 'text-denim'
                            }
                          >
                            {item.displayName}
                          </span>
                          <span className="text-sm text-dusk shrink-0">
                            Pick {item.totalQty}
                          </span>
                        </div>
                        {item.fromProperties.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.fromProperties.map((p) => (
                              <span
                                key={p.propertyId}
                                className="text-[11px] bg-mist text-denim px-2 py-0.5 rounded-full"
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
      </main>
    </div>
  );
}
