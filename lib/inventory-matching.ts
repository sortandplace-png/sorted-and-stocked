// lib/inventory-matching.ts
// Single shared definition of "confident enough to auto-link" — used by
// both the Needs Linking backlog-clearing pass and new-ingredient creation,
// so the two paths can't silently drift into different notions of a good
// match. Wraps the find_similar_inventory_items RPC (trigram similarity,
// property-scoped, returns up to 5 candidates ordered by similarity desc).
import type { SupabaseClient } from '@supabase/supabase-js';

export const AUTO_LINK_CONFIDENCE_THRESHOLD = 0.9;
// Even a top match above the confidence bar shouldn't auto-link if a
// second candidate is nearly as good — that's an "ambiguous, ask a human"
// case, not a "clear enough to skip review" one.
const AMBIGUITY_GAP = 0.1;

export type InventoryMatch = {
  id: string;
  name: string;
  location_name: string | null;
  similarity: number;
};

export async function findInventoryMatches(
  supabase: SupabaseClient,
  propertyId: string,
  name: string
): Promise<InventoryMatch[]> {
  const { data } = await supabase.rpc('find_similar_inventory_items', {
    p_property_id: propertyId,
    p_name: name,
  });
  return (data as InventoryMatch[] | null) ?? [];
}

// Returns the match to auto-link, or null if the top candidate isn't
// confident enough or is too close to the runner-up to call automatically.
export function pickAutoLinkMatch(matches: InventoryMatch[]): InventoryMatch | null {
  const [top, second] = matches;
  if (!top || top.similarity < AUTO_LINK_CONFIDENCE_THRESHOLD) return null;
  if (second && top.similarity - second.similarity < AMBIGUITY_GAP) return null;
  return top;
}

// Convenience wrapper for the common case: look up + decide in one call.
export async function findAutoLinkMatch(
  supabase: SupabaseClient,
  propertyId: string,
  name: string
): Promise<InventoryMatch | null> {
  const matches = await findInventoryMatches(supabase, propertyId, name);
  return pickAutoLinkMatch(matches);
}
