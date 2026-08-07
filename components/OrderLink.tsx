// components/OrderLink.tsx
// Shared "buy this" action -- was the word "Order" (or "Order ↗") spelled
// out separately in each of 5 files. Racquel: one shared component,
// site-wide, cart icon instead of the word. Cart = buy is the same meaning
// established on recipe ingredient rows (IngredientShoppingLink.tsx) --
// consistent, not a second meaning for the same icon.
//
// SS-448 (31 Jul, Racquel's ruling, supersedes the 20 Jul three-tier
// order): AMAZON FIRST on every ordering surface. The cart icon now always
// leads to Amazon -- the item's own Amazon link if one of its sources IS
// Amazon, otherwise an Amazon search on the item name. Existing store
// links are never deleted (R21) and stay one tap away as the named pills
// after the cart; tapping one still records it as preferred. Kosher West
// and the other kosher-store routings therefore stand, demoted to
// secondary, not removed.
'use client';

import { ShoppingCart } from 'lucide-react';
import type { ReorderSource } from '@/lib/reorder-sources';
import ReorderSourcePills from '@/components/ReorderSourcePills';
import { useRetailerDefault } from '@/components/RetailerDefaultContext';

function isAmazonUrl(url: string): boolean {
  try {
    return /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isWalmartUrl(url: string): boolean {
  try {
    return /(^|\.)walmart\.[a-z.]+$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Label for a bare reorder_link that has no named source row: the brand is
// almost always the hostname ("instacart.com" -> "Instacart").
function hostLabel(url: string): string {
  try {
    const base = new URL(url).hostname.replace(/^www\./i, '').split('.')[0];
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Store';
  } catch {
    return 'Store';
  }
}

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
  // SS-448 per-property ruling (migration 166), SS-463 array normalisation
  // (migration 234): which retailer LEADS is a property fact -- Henderson
  // ['walmart'], Lax ['amazon','walmart'], everyone else ['amazon'].
  // Amazon leads unless the array is walmart-only.
  const retailerDefault = useRetailerDefault();
  const lead = retailerDefault.includes('amazon') ? 'amazon' : retailerDefault.includes('walmart') ? 'walmart' : 'amazon';

  // Everything the item already has, as pill candidates -- sources first,
  // then the separately-maintained plain reorder_link column when there are
  // no source rows (same either-or the pre-SS-448 fallback used).
  const existing: ReorderSource[] =
    sources?.length
      ? sources
      : fallbackLink
        ? [{ id: '', retailer_name: hostLabel(fallbackLink), url: fallbackLink, is_preferred: false }]
        : [];

  // If one of the item's own links already IS the leading retailer, the
  // cart uses that (a real product link beats a search) and it doesn't
  // repeat as a pill.
  const isLeadUrl = lead === 'walmart' ? isWalmartUrl : isAmazonUrl;
  const ownLead = existing.find((s) => isLeadUrl(s.url));
  const searchUrl =
    lead === 'walmart'
      ? `https://www.walmart.com/search?q=${encodeURIComponent(itemName)}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(itemName)}`;
  const leadUrl = ownLead?.url ?? searchUrl;
  const leadName = lead === 'walmart' ? 'Walmart' : 'Amazon';
  // SS-471 fix. This used to also push a FABRICATED secondary pill (a bare
  // search URL, not a real product link) whenever the property's
  // default_retailer named a second retailer the item had no actual
  // source for -- "amazon+walmart" on Lax meant every single item got a
  // Walmart pill, including the 772 of 946 Lax items with zero Walmart
  // sourcing. Racquel's 7 Aug screenshot proved it: five Basement Bath
  // items, all Amazon-only, all showing a Walmart pill that led to a
  // generic search, not a product. A generic search URL is not a retailer
  // option and must not render as if it were one (that's the whole of
  // SS-471's title). Pills now come ONLY from `existing` -- an item's own
  // real stored sources -- never synthesized from the property's retailer
  // list. default_retailer's only remaining job is choosing `lead` above,
  // for the one case where the item has no matching link at all and the
  // cart icon has to fall back to a search.
  const secondary = existing.filter((s) => s !== ownLead);

  const amazonUrl = leadUrl;
  const label = ownLead ? `Order ${itemName} — ${leadName}` : `Search for ${itemName} on ${leadName}`;

  const iconClass =
    variant === 'conceptB'
      ? 'text-brass hover:text-denim bg-mist'
      : 'text-brass hover:bg-linen border border-cardBorder';

  const cart = (
    <a
      href={amazonUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${iconClass} ${secondary.length ? '' : className}`}
    >
      <ShoppingCart size={14} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );

  if (secondary.length === 0) return cart;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {cart}
      <ReorderSourcePills sources={secondary} variant={variant} min={1} />
    </span>
  );
}
