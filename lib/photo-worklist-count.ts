// lib/photo-worklist-count.ts
// SS-869 part 3: the live count shown on the Inventory and My Day entry
// points, and the same WHERE shape the worklist page itself lists by --
// one implementation so the two counts (and the list they point at) can
// never disagree about what "needs a photo" means. photo_url IS NULL (or
// empty string) directly, never photo_needs_sourcing -- that flag is what
// let Henderson's empty state lie about a real 175-item backlog.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPhotolessCount(supabase: SupabaseClient, propertyId: string): Promise<number> {
  const { count } = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .or('photo_url.is.null,photo_url.eq.');
  return count ?? 0;
}
