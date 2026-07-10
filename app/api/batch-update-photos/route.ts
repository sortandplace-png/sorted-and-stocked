// app/api/batch-update-photos/route.ts
import { createClient } from '@supabase/supabase-js';
import { batchFetchPhotos, type ProductResult } from '@/lib/instacart-fetcher';
import { persistPhoto } from '@/lib/persist-photo';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { propertyId, limit = 50 } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId required' }, { status: 400 });
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all unique ingredient names from recipe_ingredients where photo_url is null
    const { data: ingredients, error: fetchError } = await supabase
      .from('recipe_ingredients')
      .select('name')
      .is('photo_url', null)
      .limit(limit);

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!ingredients || ingredients.length === 0) {
      return Response.json({ message: 'No ingredients to update', updated: 0 });
    }

    // Get unique ingredient names
    const uniqueNames = [...new Set(ingredients.map(i => i.name))];

    // Fetch photos for batch
    const photos = await batchFetchPhotos(uniqueNames);

    // Update recipe_ingredients table with photos
    let updateCount = 0;
    const updateErrors: { ingredient: string; error: string }[] = [];

    for (const result of photos) {
      if (result.photo_url) {
        const permanentUrl = await persistPhoto(
          supabase,
          result.name,
          result.photo_candidates?.length ? result.photo_candidates : result.photo_url
        );

        if (!permanentUrl) {
          updateErrors.push({ ingredient: result.name, error: 'Failed to persist to storage' });
          continue;
        }

        console.log(`[PHOTO] Updating ${result.name}: ${permanentUrl}`);

        const { error: updateError } = await supabase
          .from('recipe_ingredients')
          .update({
            photo_url: permanentUrl,
          })
          .eq('name', result.name);

        if (updateError) {
          console.error(`[PHOTO ERROR] Failed to update ${result.name}:`, updateError);
          updateErrors.push({ ingredient: result.name, error: updateError.message });
        } else {
          updateCount++;
          console.log(`[PHOTO SUCCESS] Updated ${result.name}`);
        }
      }
    }

    const response: {
      message: string;
      updated: number;
      total: number;
      photos: ProductResult[];
      errors?: { ingredient: string; error: string }[];
    } = {
      message: `Updated ${updateCount} of ${photos.length} ingredients with photos`,
      updated: updateCount,
      total: uniqueNames.length,
      photos: photos.slice(0, 5),
    };

    if (updateErrors.length > 0) {
      response.errors = updateErrors;
    }

    return Response.json(response);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
