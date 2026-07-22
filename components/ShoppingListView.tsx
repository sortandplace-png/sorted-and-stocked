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

// Formats the still-pending items as plain text grouped by aisle, then opens
// wa.me with it pre-filled. wa.me works whether or not WhatsApp is installed
// (falls back to WhatsApp Web on desktop), so no native share-sheet
// permission dance is needed.
function shareToWhatsApp(items: ShoppingListItem[]) {
  const pending = items.filter((i) => i.status === 'pending');
  const grouped = groupByCategory(pending);
  const lines = ['🛒 Shopping List', ''];
  for (const [category, categoryItems] of grouped) {
    lines.push(`*${category}*`);
    for (const item of categoryItems) {
      lines.push(`☐ ${item.name}${item.qty_needed > 1 ? ` ×${item.qty_needed}` : ''}`);
    }
    lines.push('');
  }
  const text = encodeURIComponent(lines.join('\n').trim());
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

export default function ShoppingListView({ items, onToggle }: ShoppingListViewProps) {
  const [hidePurchased, setHidePurchased] = useState(false);

  const visible = hidePurchased ? items.filter((i) => i.status === 'pending') : items;
  const grouped = useMemo(() => groupByCategory(visible), [visible]);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto print:max-w-full">
      <div className="hidden print:block mb-4">
        <h1 className="font-display text-2xl text-denim">Shopping List</h1>
        <p className="text-sm text-dusk">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex items-center justify-between mb-3 px-1 print:hidden">
        <span className="text-sm text-dusk">
          {items.filter((i) => i.status === 'pending').length} items left
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dusk">
            <input
              type="checkbox"
              checked={hidePurchased}
              onChange={(e) => setHidePurchased(e.target.checked)}
              className="accent-gold"
            />
            Hide checked off
          </label>
          <button
            onClick={() => shareToWhatsApp(items)}
            className="text-sm font-medium bg-sage text-white px-4 py-1.5 rounded-full"
          >
            💬 WhatsApp
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      <div className="lg:columns-2 lg:gap-4">
      {grouped.map(([category, categoryItems]) => (
        <section key={category} className="mb-4 break-inside-avoid print:break-inside-avoid">
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="h-px flex-1 bg-linen" />
            <h3 className="text-xs font-display italic tracking-[0.1em] text-dusk whitespace-nowrap">
              {category}
            </h3>
            <span className="h-px flex-1 bg-linen" />
          </div>
          <ul className="divide-y divide-cardBorder rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden print:shadow-none print:border print:border-cardBorder">
            {categoryItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-linen transition-colors print:py-1.5"
              >
                <label className="flex items-center justify-center w-11 h-11 -m-3 shrink-0 cursor-pointer print:hidden">
                  <input
                    type="checkbox"
                    checked={item.status === 'purchased'}
                    onChange={(e) =>
                      onToggle(item.id, e.target.checked ? 'purchased' : 'pending')
                    }
                    className="h-5 w-5 accent-gold rounded"
                  />
                </label>
                <span className="hidden print:inline text-dusk shrink-0">☐</span>
                <span
                  className={
                    item.status === 'purchased'
                      ? 'line-through text-dusk flex-1'
                      : 'text-denim flex-1'
                  }
                >
                  {item.name}
                </span>
                <span className="text-sm text-dusk">×{item.qty_needed}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}
