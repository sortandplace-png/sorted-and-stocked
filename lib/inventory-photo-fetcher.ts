// lib/inventory-photo-fetcher.ts
// Fetches a product photo from an inventory item's reorder_link by
// extracting the page's og:image meta tag — the same method already
// proven for manufacturer pages in lib/instacart-fetcher.ts, applied here
// to real stored reorder_links instead.
//
// Instacart's robots.txt disallows every unnamed user-agent from the whole
// site (a catch-all "User-Agent: * / Disallow: /" at the bottom, after a
// list of specifically-permitted bots like Googlebot). Confirmed by
// checking robots.txt directly — a generic fetch technically succeeds
// (200, real product data embedded in JSON-LD) but that doesn't make it
// permitted, so we don't use it. Instead, extract which retailer the link
// points at (from the `retailerSlug` query param, e.g.
// instacart.com/products/123-item?retailerSlug=walmart) and fall back to
// that retailer's own search-results page. Search-results pages often only
// expose a generic site-logo og:image rather than a specific product's, so
// this fallback has a materially lower hit rate than a direct product
// link — that's expected, not a bug. Items with no retailerSlug at all
// (some Instacart links omit it) simply can't be resolved this way.

function extractStoreFromInstacartUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const slug = parsed.searchParams.get('retailerSlug');
    return slug ? slug.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Only retailers verified (via direct curl test) to return 200 for a
// server-side fetch. ShopRite and Stop & Shop both 403 generic requests
// (bot-detection) — not included. Costco's search endpoint 404s directly
// now (likely needs JS/session handling) despite working for the
// shopping-link feature earlier — also excluded rather than guessing at a
// fix for one item. Bingo Wholesale and Superfresh are regional stores
// without a confidently-known domain — not guessing at those either.
function buildFallbackSearchUrl(store: string, itemName: string): string | null {
  const term = encodeURIComponent(itemName);
  switch (store) {
    case 'walmart':
      return `https://www.walmart.com/search?q=${term}`;
    case 'gourmet-glatt':
      return `https://www.gourmetglattonline.com/search/${itemName}`;
    case 'evergreen-kosher':
      return `https://www.shopevergreenkosher.com/search/${itemName}`;
    default:
      return null;
  }
}

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export interface InventoryPhotoResult {
  itemId: string;
  itemName: string;
  photoUrl: string | null;
  sourceUsed: 'direct' | 'instacart-fallback' | 'none';
  fallbackStore?: string;
  reason?: string;
}

export async function fetchInventoryPhoto(
  itemId: string,
  itemName: string,
  reorderLink: string
): Promise<InventoryPhotoResult> {
  const isInstacart = reorderLink.includes('instacart.com');

  if (!isInstacart) {
    const photoUrl = await extractOgImage(reorderLink);
    return {
      itemId,
      itemName,
      photoUrl,
      sourceUsed: photoUrl ? 'direct' : 'none',
      reason: photoUrl ? undefined : 'No og:image found on reorder_link page',
    };
  }

  const store = extractStoreFromInstacartUrl(reorderLink);
  const fallbackUrl = store ? buildFallbackSearchUrl(store, itemName) : null;

  if (!fallbackUrl) {
    return {
      itemId,
      itemName,
      photoUrl: null,
      sourceUsed: 'none',
      reason: store
        ? `Instacart link, but no fallback URL builder for store "${store}"`
        : 'Instacart link, could not determine underlying store from URL',
    };
  }

  const photoUrl = await extractOgImage(fallbackUrl);
  return {
    itemId,
    itemName,
    photoUrl,
    sourceUsed: photoUrl ? 'instacart-fallback' : 'none',
    fallbackStore: store ?? undefined,
    reason: photoUrl ? undefined : `No og:image found on ${store} search-results fallback page`,
  };
}
