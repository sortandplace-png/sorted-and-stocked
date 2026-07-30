// lib/cross-house-inventory.ts
// Grouping for the cross-house inventory console (SS-399).
//
// THE KEY IS DELIBERATELY SWAPPABLE. v1 groups on a normalised name because
// master_products cannot do the job yet: master_products.property_id is NOT
// NULL, so "Windex" on Lax and "Windex" on Main are two unrelated rows --
// it cannot express cross-property identity, which is the one thing this
// console needs. It is also empty (0 rows). When a genuinely global catalog
// exists, only productKey() changes; nothing else in this file or its
// callers has to move.
//
// PER-HOUSE QUANTITIES ARE INTENTIONAL HERE (confirmed 30 Jul). The
// no-quantities rule applies to the shared catalogue and digest, which
// cross household boundaries. This console does not: every row reaching it
// has already passed inventory_items_select_member / is_property_member, so
// it only ever shows houses the viewer is themselves a member of.
import type { ReorderSource } from '@/lib/reorder-sources';

export type HouseInventoryRow = {
  id: string;
  property_id: string;
  property_name: string;
  name: string;
  name_es: string | null;
  category: string | null;
  current_qty: number | null;
  min_qty: number | null;
  last_counted_at: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
};

/** One house's contribution to a product group. rowCount matters: seven
 *  bathrooms each stocking bedika cloths is seven inventory rows in one
 *  house, and the console must roll those into one line without implying
 *  the house holds a single unit. */
export type HouseTally = {
  propertyId: string;
  propertyName: string;
  qty: number;
  rowCount: number;
  neverCountedRows: number;
  /** True when NO row for this product in this house has ever been counted
   *  -- a qty of 0 then means "nobody has looked", not "we are out". */
  allNeverCounted: boolean;
  isLow: boolean;
};

export type ProductGroup = {
  key: string;
  displayName: string;
  displayNameEs: string | null;
  category: string | null;
  houses: HouseTally[];
  totalQty: number;
  /** Low in at least one house. */
  anyLow: boolean;
  /** Never counted in EVERY house it appears in. */
  allNeverCounted: boolean;
  photoUrl: string | null;
  reorderLink: string | null;
  reorderSources: ReorderSource[] | null;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Swap point. Today: normalised name. Later: row.master_product_id ??
 *  normalizeName(row.name), once master_products is global and populated. */
export function productKey(row: HouseInventoryRow): string {
  return normalizeName(row.name);
}

// Matches isLowStock() in InventoryClient.tsx and the v_low_stock_* views:
// counted, eligible, at-or-below minimum. Kept in one place here so the
// console cannot drift from the rest of the app's definition of "low".
function rowIsLow(row: HouseInventoryRow): boolean {
  if (row.last_counted_at === null) return false;
  if (row.min_qty === null) return false;
  return (row.current_qty ?? 0) <= row.min_qty;
}

export function groupByProduct(
  rows: HouseInventoryRow[],
  keyFn: (row: HouseInventoryRow) => string = productKey
): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  for (const row of rows) {
    const key = keyFn(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        displayName: row.name,
        displayNameEs: row.name_es,
        category: row.category,
        houses: [],
        totalQty: 0,
        anyLow: false,
        allNeverCounted: true,
        photoUrl: null,
        reorderLink: null,
        reorderSources: null,
      };
      groups.set(key, group);
    }

    // First non-null wins for the shared display fields -- these are the
    // same product across houses, so any house's photo/link represents it.
    group.photoUrl ??= row.photo_url;
    group.reorderLink ??= row.reorder_link;
    if (!group.reorderSources?.length && row.reorder_sources?.length) {
      group.reorderSources = row.reorder_sources;
    }
    group.displayNameEs ??= row.name_es;
    group.category ??= row.category;

    const qty = row.current_qty ?? 0;
    const never = row.last_counted_at === null;
    const low = rowIsLow(row);

    let house = group.houses.find((h) => h.propertyId === row.property_id);
    if (!house) {
      house = {
        propertyId: row.property_id,
        propertyName: row.property_name,
        qty: 0,
        rowCount: 0,
        neverCountedRows: 0,
        allNeverCounted: true,
        isLow: false,
      };
      group.houses.push(house);
    }
    house.qty += qty;
    house.rowCount += 1;
    if (never) house.neverCountedRows += 1;
    else house.allNeverCounted = false;
    if (low) house.isLow = true;

    group.totalQty += qty;
    if (low) group.anyLow = true;
    if (!never) group.allNeverCounted = false;
  }

  for (const group of groups.values()) {
    group.houses.sort((a, b) => a.propertyName.localeCompare(b.propertyName));
  }

  return [...groups.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}
