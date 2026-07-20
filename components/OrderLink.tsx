// components/OrderLink.tsx
// Shared "buy this" action -- was the word "Order" (or "Order ↗") spelled
// out separately in each of 5 files. Racquel: one shared component,
// site-wide, cart icon instead of the word. Cart = buy is the same meaning
// established on recipe ingredient rows (IngredientShoppingLink.tsx) --
// consistent, not a second meaning for the same icon.
//
// Falls back to a generic Amazon search when there's no configured
// reorder_sources row at all, rather than rendering nothing -- confirmed
// live only ~70% of pending shopping list rows have an explicit source.
// "Nothing renders blank" was the explicit ask; same fallback-search
// pattern IngredientShoppingLink.tsx already uses for its alternate-store
// list, not a new idea introduced here.
'use client';

import { ShoppingCart } from 'lucide-react';
import { getPreferredSource, type ReorderSource } from '@/lib/reorder-sources';
import ReorderSourcePills from '@/components/ReorderSourcePills';

export default function OrderLink({
  itemName,
  sources,
  variant = 'conceptB',
  className = '',
}: {
  itemName: string;
  sources: ReorderSource[] | null | undefined;
  variant?: 'default' | 'conceptB';
  className?: string;
}) {
  if ((sources?.length ?? 0) > 1) {
    return <ReorderSourcePills sources={sources!} variant={variant} className={className} />;
  }

  const preferred = getPreferredSource(sources);
  const url = preferred?.url ?? `https://www.amazon.com/s?k=${encodeURIComponent(itemName)}`;
  const label = preferred ? `Order ${itemName} — ${preferred.retailer_name}` : `Search for ${itemName} on Amazon`;

  const iconClass =
    variant === 'conceptB'
      ? 'text-brass hover:text-denim bg-mist'
      : 'text-gold-dark hover:bg-gold-light/10 border border-gold-light/60';

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
