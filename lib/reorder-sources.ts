// lib/reorder-sources.ts
// Shared shape for the reorder_sources table -- every read site (list rows,
// shopping list, scan screen, dashboard) selects this same embed
// (`reorder_sources(id, retailer_name, url, is_preferred)`) via PostgREST's
// automatic FK-relationship embedding, or gets the equivalent jsonb array
// back from get_shopping_list_with_inventory. getPreferredSource() is the
// one place that decides which row wins if is_preferred is ever
// inconsistent (defensive only -- the DB's partial unique index and the
// set_preferred_reorder_source/delete_reorder_source RPCs are what
// actually keep it to exactly one).

export type ReorderSource = {
  id: string;
  retailer_name: string;
  url: string;
  is_preferred: boolean;
};

export function getPreferredSource(sources: ReorderSource[] | null | undefined): ReorderSource | null {
  if (!sources || sources.length === 0) return null;
  return sources.find((s) => s.is_preferred) ?? sources[0];
}
