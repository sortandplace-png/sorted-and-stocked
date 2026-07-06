// components/ShoppingListView.tsx
'use client';

import { useMemo, useState } from 'react';

export type ShoppingListItem = {
  id: string;
  name: string;
  category: string | null;
  qty_needed: number;
  status: 'pending' | 'purchased';
};

type ShoppingListViewProps = {
  items: ShoppingListItem[];
  onToggle: (itemId: string, nextStatus: 'pending' | 'purchased') => void;
};

const UNCATEGORIZED = 'Uncategorized';

// Rough shelf order for a typical grocery store loop — produce/perishables
// first, pantry staples last. Anything not in this list sorts alphabetically
// after the known categories.
const AISLE_ORDER = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Frozen',
  'Pantry',
  'Paper Goods',
  'Cleaners',
  'Personal Care',
  UNCATEGORIZED,
];

function groupByCategory(items: ShoppingListItem[]) {
  const groups = new Map<string, ShoppingListItem[]>();
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

export default function ShoppingListView({ items, onToggle }: ShoppingListViewProps) {
  const [hidePurchased, setHidePurchased] = useState(false);

  const visible = hidePurchased ? items.filter((i) => i.status === 'pending') : items;
  const grouped = useMemo(() => groupByCategory(visible), [visible]);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto print:max-w-full">
      <div className="hidden print:block mb-4">
        <h1 className="font-display text-2xl text-aubergine">Shopping List</h1>
        <p className="text-sm text-ink/50">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex items-center justify-between mb-3 px-1 print:hidden">
        <span className="text-sm text-ink/50">
          {items.filter((i) => i.status === 'pending').length} items left
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink/60">
            <input
              type="checkbox"
              checked={hidePurchased}
              onChange={(e) => setHidePurchased(e.target.checked)}
              className="accent-aubergine"
            />
            Hide checked off
          </label>
          <button
            onClick={() => window.print()}
            className="text-sm font-medium bg-aubergine text-cream px-4 py-1.5 rounded-full"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      <div className="lg:columns-2 lg:gap-4">
      {grouped.map(([category, categoryItems]) => (
        <section key={category} className="mb-4 break-inside-avoid print:break-inside-avoid">
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="h-px flex-1 bg-gold-light" />
            <h3 className="text-xs font-display italic tracking-[0.1em] text-aubergine/70 whitespace-nowrap">
              {category}
            </h3>
            <span className="h-px flex-1 bg-gold-light" />
          </div>
          <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-aubergine/5 overflow-hidden print:shadow-none print:border print:border-gold-light">
            {categoryItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gold-light/15 transition-colors print:py-1.5"
              >
                <input
                  type="checkbox"
                  checked={item.status === 'purchased'}
                  onChange={(e) =>
                    onToggle(item.id, e.target.checked ? 'purchased' : 'pending')
                  }
                  className="h-5 w-5 shrink-0 accent-aubergine rounded print:hidden"
                />
                <span className="hidden print:inline text-ink/40 shrink-0">☐</span>
                <span
                  className={
                    item.status === 'purchased'
                      ? 'line-through text-ink/30 flex-1'
                      : 'text-ink flex-1'
                  }
                >
                  {item.name}
                </span>
                <span className="text-sm text-ink/40">×{item.qty_needed}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}
