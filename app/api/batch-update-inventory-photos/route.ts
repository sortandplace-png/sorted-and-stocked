// app/api/batch-update-inventory-photos/route.ts
import { createClient } from '@supabase/supabase-js';
import { fetchInventoryPhoto } from '@/lib/inventory-photo-fetcher';
import { persistPhoto } from '@/lib/persist-photo';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { propertyId, limit = 5, dryRun = false, excludeInstacart = false } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Instacart links only ever resolve through a retailer search-page
    // fallback, which has a near-0% hit rate (search pages are often
    // JS-rendered SPAs with no static og:image) — skip them when the caller
    // wants to spend time only on the direct-manufacturer-site path. Written
    // as a ternary rather than reassigning a `let` query builder — the
    // latter makes the Supabase filter-builder generic recurse until
    // TypeScript gives up (TS2589).
    const { data: items, error: fetchError } = await (excludeInstacart
      ? supabase
          .from('inventory_items')
          .select('id, name, reorder_link')
          .eq('property_id', propertyId)
          .is('photo_url', null)
          .not('reorder_link', 'is', null)
          .not('reorder_link', 'ilike', '%instacart%')
          .limit(limit)
      : supabase
          .from('inventory_items')
          .select('id, name, reorder_link')
          .eq('property_id', propertyId)
          .is('photo_url', null)
          .not('reorder_link', 'is', null)
          .limit(limit));

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }
    if (!items || items.length === 0) {
      return Response.json({ message: 'No items to update', updated: 0, results: [] });
    }

    const results = [];
    let updateCount = 0;

    for (const item of items) {
      const result = await fetchInventoryPhoto(item.id, item.name, item.reorder_link!);

      if (!result.photoUrl) {
        results.push(result);
        continue;
      }

      if (dryRun) {
        results.push(result);
        continue;
      }

      const permanentUrl = await persistPhoto(supabase, item.name, result.photoUrl, 'inventory-photos');
      if (!permanentUrl) {
        results.push({ ...result, photoUrl: null, reason: 'Found og:image but failed to persist to storage' });
        continue;
      }

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ photo_url: permanentUrl })
        .eq('id', item.id);

      if (updateError) {
        results.push({ ...result, photoUrl: null, reason: updateError.message });
        continue;
      }

      updateCount++;
      results.push({ ...result, photoUrl: permanentUrl });
    }

    return Response.json({
      message: dryRun
        ? `Dry run: ${results.filter((r) => r.photoUrl).length} of ${items.length} would succeed`
        : `Updated ${updateCount} of ${items.length} items`,
      updated: updateCount,
      total: items.length,
      results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
