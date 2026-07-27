// lib/product-groups.ts
// Turns flat inventory rows into the variety x location matrix a grouped
// product card needs.
//
// Two dimensions, both real, neither reducible to the other:
//   VARIETY  -- genuinely different products under one name (Red Cabbage
//               whole head vs Bodek pre-checked; cinnamon sticks vs ground)
//   LOCATION -- the same variety stocked in several places (plain Trash Bags
//               in nine bathrooms), which is the correct per-location pattern
//               and must never be collapsed
//
// Trash Bags is the shape to keep in mind: 5 varieties across 11 locations,
// 17 rows -- and the named varieties are themselves in 2 locations each, so
// this is a real matrix rather than "varieties plus some location rows".
//
// QUANTITIES ARE NEVER SUMMED ACROSS LOCATIONS. "2 in Kitchen, 1 in Kitchen
// pantry" is actionable; "3" is not, because you cannot go and fetch "3".
// Per-variety totals are exposed only as `rowCount`/`locationCount`, never as
// a merged quantity.

export type GroupableItem = {
  id: string;
  name: string;
  name_es: string | null;
  location_id: string | null;
  current_qty: number;
  unit: string;
  master_product_id: string | null;
  variant_label: string | null;
  variant_label_es: string | null;
};

export type MasterProduct = { id: string; name: string; name_es: string | null };

export type VarietyRow<T> = { locationId: string | null; item: T };

export type Variety<T> = {
  /** Stable key: the variant label, or the item name when unlabelled. */
  key: string;
  label: string;
  labelEs: string | null;
  rows: VarietyRow<T>[];
  locationCount: number;
};

export type ProductGroup<T> = {
  masterProductId: string;
  name: string;
  nameEs: string | null;
  varieties: Variety<T>[];
  varietyCount: number;
  /** DISTINCT locations across the whole product, not the sum of each
   *  variety's location count -- two varieties in the same room is one
   *  location, and double counting would overstate the card. */
  locationCount: number;
  rowCount: number;
};

export type PartitionedInventory<T> = {
  groups: ProductGroup<T>[];
  ungrouped: T[];
};

/**
 * Splits items into grouped products and ungrouped items.
 *
 * An item is grouped only when it has a master_product_id AND that product is
 * known. An unknown id degrades to ungrouped rather than inventing a group --
 * an orphaned reference should look like a normal item, not a phantom product.
 */
export function partitionByProduct<T extends GroupableItem>(
  items: T[],
  masterProducts: MasterProduct[]
): PartitionedInventory<T> {
  const productById = new Map(masterProducts.map((p) => [p.id, p]));
  const grouped = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const item of items) {
    const pid = item.master_product_id;
    if (pid && productById.has(pid)) {
      const list = grouped.get(pid) ?? [];
      list.push(item);
      grouped.set(pid, list);
    } else {
      ungrouped.push(item);
    }
  }

  const groups: ProductGroup<T>[] = [];
  for (const [pid, groupItems] of grouped) {
    const product = productById.get(pid)!;

    // Cluster by variant label. Items under a product with no label yet fall
    // together under their own name, so a half-labelled group still reads
    // sensibly instead of collapsing into one nameless variety.
    const byVariety = new Map<string, T[]>();
    for (const item of groupItems) {
      const key = item.variant_label?.trim() || item.name;
      const list = byVariety.get(key) ?? [];
      list.push(item);
      byVariety.set(key, list);
    }

    const varieties: Variety<T>[] = Array.from(byVariety.entries())
      .map(([key, rows]) => ({
        key,
        label: rows[0].variant_label?.trim() || rows[0].name,
        labelEs: rows[0].variant_label_es?.trim() || rows[0].name_es,
        rows: rows.map((item) => ({ locationId: item.location_id, item })),
        locationCount: new Set(rows.map((r) => r.location_id)).size,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    groups.push({
      masterProductId: pid,
      name: product.name,
      nameEs: product.name_es,
      varieties,
      varietyCount: varieties.length,
      locationCount: new Set(groupItems.map((i) => i.location_id)).size,
      rowCount: groupItems.length,
    });
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));
  return { groups, ungrouped };
}

/** The same rows pivoted location-first -- "what's in Girls Bath" is a real
 *  question, and it's the secondary view on a grouped card. */
export type LocationPivot<T> = {
  locationId: string | null;
  rows: { label: string; labelEs: string | null; item: T }[];
};

export function pivotByLocation<T extends GroupableItem>(group: ProductGroup<T>): LocationPivot<T>[] {
  const byLocation = new Map<string | null, { label: string; labelEs: string | null; item: T }[]>();
  for (const variety of group.varieties) {
    for (const row of variety.rows) {
      const list = byLocation.get(row.locationId) ?? [];
      list.push({ label: variety.label, labelEs: variety.labelEs, item: row.item });
      byLocation.set(row.locationId, list);
    }
  }
  return Array.from(byLocation.entries()).map(([locationId, rows]) => ({ locationId, rows }));
}
