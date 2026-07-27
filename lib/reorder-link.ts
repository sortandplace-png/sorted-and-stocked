// lib/reorder-link.ts
// Tells a SEARCH link apart from a real PRODUCT link.
//
// 697 of 1,574 reorder links (44%) are search queries rather than product
// pages -- Amazon 422, Instacart 226, other 49. A search link can't say which
// product is meant: `instacart.com/store/walmart/s?k=purple+cabbage` returns
// whatever matches today, which is exactly why nobody could tell whether that
// row was a 16 oz bag or a whole head.
//
// This matters MORE under variant grouping, not less: the point of grouping
// is that each variety keeps its own product link, and today 44% of them keep
// a guess. Surfacing it is deliberate -- it is not auto-fixable, because only
// a person can say which product was actually meant.
//
// Detection is conservative: it looks for real search markers (a search path
// segment, or a recognised query parameter) rather than guessing from URL
// shape. A false "product" reading is safer than a false "search" warning,
// since the badge is a prompt to check, not a blocker.

const SEARCH_PATH = /\/(s|search|sch|results)(\/|\?|$)/i;
const SEARCH_PARAM = /[?&](k|q|query|search|keyword|kw|st|term)=/i;

export type ReorderLinkKind = 'product' | 'search' | 'none';

export function classifyReorderLink(url: string | null | undefined): ReorderLinkKind {
  if (!url || !url.trim()) return 'none';
  const u = url.trim();
  if (SEARCH_PATH.test(u) || SEARCH_PARAM.test(u)) return 'search';
  return 'product';
}

export function isSearchLink(url: string | null | undefined): boolean {
  return classifyReorderLink(url) === 'search';
}
