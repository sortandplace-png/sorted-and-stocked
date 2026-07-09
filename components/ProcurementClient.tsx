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

  const supabase = createClient();
  const showToast = useToast();

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
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-4 py-3 bg-cream text-charcoal border-b border-gold-light/40 sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoMark className="w-9 h-9" />
          <span className="font-display text-lg">Procurement</span>
        </div>
        <Link href="/properties" className="text-sm text-charcoal/60">
          ← Properties
        </Link>
      </header>

      <main className="max-w-md lg:max-w-4xl mx-auto p-4 print:max-w-full">
        <div className="hidden print:block mb-4">
          <h1 className="font-display text-2xl text-charcoal">Combined Shopping Trip</h1>
          <p className="text-sm text-charcoal/50">
            {properties.filter((p) => selectedIds.has(p.id)).map((p) => p.name).join(', ')} —{' '}
            {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-4 print:hidden">
          <h2 className="text-sm font-medium text-charcoal mb-2">Include properties</h2>
          <div className="flex flex-wrap gap-2">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProperty(p.id)}
                className={
                  selectedIds.has(p.id)
                    ? 'px-3 py-1.5 rounded-full text-sm bg-charcoal text-cream'
                    : 'px-3 py-1.5 rounded-full text-sm bg-cream border border-charcoal/30 text-charcoal'
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
          <span className="text-sm text-charcoal/50">
            {stitched.filter((i) => !i.allPurchased).length} items left across{' '}
            {selectedIds.size} propert{selectedIds.size === 1 ? 'y' : 'ies'}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-charcoal/60">
              <input
                type="checkbox"
                checked={hidePurchased}
                onChange={(e) => setHidePurchased(e.target.checked)}
                className="accent-gold"
              />
              Hide picked up
            </label>
            <button
              onClick={() => window.print()}
              className="text-sm font-medium bg-charcoal text-cream px-4 py-1.5 rounded-full"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonList />
        ) : stitched.length === 0 ? (
          <p className="text-sm text-charcoal/40 text-center mt-8">
            Nothing on any selected property's list right now.
          </p>
        ) : (
          <div className="lg:columns-2 lg:gap-4">
            {grouped.map(([category, items]) => (
              <section key={category} className="mb-4 break-inside-avoid print:break-inside-avoid">
                <div className="flex items-center gap-2 px-3 mb-2">
                  <span className="h-px flex-1 bg-gold-light" />
                  <h3 className="text-xs font-display italic tracking-[0.1em] text-charcoal/70 whitespace-nowrap">
                    {category}
                  </h3>
                  <span className="h-px flex-1 bg-gold-light" />
                </div>
                <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden print:shadow-none print:border print:border-gold-light">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-start gap-3 px-4 py-3 print:py-1.5">
                      <input
                        type="checkbox"
                        checked={item.allPurchased}
                        onChange={(e) => markGroupPurchased(item, e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-gold rounded mt-0.5 print:hidden"
                      />
                      <span className="hidden print:inline text-charcoal/40 shrink-0">☐</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={
                              item.allPurchased ? 'line-through text-charcoal/30' : 'text-charcoal'
                            }
                          >
                            {item.displayName}
                          </span>
                          <span className="text-sm text-charcoal/40 shrink-0">
                            Pick {item.totalQty}
                          </span>
                        </div>
                        {item.fromProperties.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.fromProperties.map((p) => (
                              <span
                                key={p.propertyId}
                                className="text-[11px] bg-gold-light/40 text-charcoal px-2 py-0.5 rounded-full"
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
