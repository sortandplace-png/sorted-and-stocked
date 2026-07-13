// app/api/batch-update-recipe-photos/route.ts
import { createClient } from '@supabase/supabase-js';
import { fetchProductPhoto } from '@/lib/instacart-fetcher';
import { persistPhoto } from '@/lib/persist-photo';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { propertyId, limit = 50 } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Recipes are shared across every property Racquel owns (migration 072).
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select('id, name, recipe_property_links!inner(property_id)')
      .eq('recipe_property_links.property_id', propertyId)
      .is('photo_url', null)
      .limit(limit);

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!recipes || recipes.length === 0) {
      return Response.json({ message: 'No recipes to update', updated: 0 });
    }

    let updateCount = 0;
    const updateErrors: Array<{ recipe: string; error: string }> = [];

    for (const recipe of recipes) {
      const result = await fetchProductPhoto(recipe.name);

      if (!result.photo_candidates?.length && !result.photo_url) {
        continue;
      }

      const permanentUrl = await persistPhoto(
        supabase,
        recipe.name,
        result.photo_candidates?.length ? result.photo_candidates : (result.photo_url as string),
        'recipe-photos'
      );

      if (!permanentUrl) {
        updateErrors.push({ recipe: recipe.name, error: 'Failed to persist to storage' });
        continue;
      }

      const { error: updateError } = await supabase
        .from('recipes')
        .update({ photo_url: permanentUrl })
        .eq('id', recipe.id);

      if (updateError) {
        updateErrors.push({ recipe: recipe.name, error: updateError.message });
      } else {
        updateCount++;
      }
    }

    const response: Record<string, unknown> = {
      message: `Updated ${updateCount} of ${recipes.length} recipes with photos`,
      updated: updateCount,
      total: recipes.length,
    };
    if (updateErrors.length > 0) response.errors = updateErrors;

    return Response.json(response);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
