// components/OrderLink.tsx
// Shared "buy this" action -- was the word "Order" (or "Order ↗") spelled
// out separately in each of 5 files. Racquel: one shared component,
// site-wide, cart icon instead of the word. Cart = buy is the same meaning
// established on recipe ingredient rows (IngredientShoppingLink.tsx) --
// consistent, not a second meaning for the same icon.
//
// Three-tier fallback (2026-07-20, Racquel's required order):
// reorder_sources (this item's configured retailer rows) -> the item's own
// inventory_items.reorder_link (a second, separately-maintained link field
// -- the Edit Item modal / ReorderSourcePicker read reorder_sources, but
// this plain column has always been a real, independently-editable field)
// -> generic Amazon search, rather than rendering nothing. Confirmed live
// only ~70% of pending shopping list rows have an explicit reorder_sources
// row; some of the remainder still have a real reorder_link that was being
// skipped entirely before this. "Nothing renders blank" was the explicit
// ask; same fallback-search pattern IngredientShoppingLink.tsx already uses
// for its alternate-store list, not a new idea introduced here.
'use client';

import { ShoppingCart } from 'lucide-react';
import { getPreferredSource, type ReorderSource } from '@/lib/reorder-sources';
import ReorderSourcePills from '@/components/ReorderSourcePills';

export default function OrderLink({
  itemName,
  sources,
  fallbackLink,
  variant = 'conceptB',
  className = '',
}: {
  itemName: string;
  sources: ReorderSource[] | null | undefined;
  fallbackLink?: string | null;
  variant?: 'default' | 'conceptB';
  className?: string;
}) {
  if ((sources?.length ?? 0) > 1) {
    return <ReorderSourcePills sources={sources!} variant={variant} className={className} />;
  }

  const preferred = getPreferredSource(sources);
  const url = preferred?.url || fallbackLink || `https://www.amazon.com/s?k=${encodeURIComponent(itemName)}`;
  const label = preferred
    ? `Order ${itemName} — ${preferred.retailer_name}`
    : fallbackLink
      ? `Order ${itemName}`
      : `Search for ${itemName} on Amazon`;

  const iconClass =
    variant === 'conceptB'
      ? 'text-brass hover:text-denim bg-mist'
      : 'text-brass hover:bg-linen border border-cardBorder';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${iconClass} ${className}`}
    >
      <ShoppingCart size={14} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
