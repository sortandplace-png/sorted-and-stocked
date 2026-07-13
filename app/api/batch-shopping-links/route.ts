// app/api/batch-shopping-links/route.ts
import { createClient } from '@supabase/supabase-js';
import {
  buildShoppingLinkRecommendation,
  getAllAlternativeUrls,
  type IngredientWithContext,
} from '@/lib/shopping-link-builder';

export const maxDuration = 300; // 5 minute timeout for batch operations

interface RecipeIngredientRow {
  id: string;
  name: string;
  recipe_id: string;
  recipes?: { kosher_type?: string };
}

export async function POST(request: Request) {
  try {
    const { propertyId, dryRun = false, limit = 500 } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId required' }, { status: 400 });
    }

    // Use service role key to bypass RLS for batch operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all recipes visible to this property (recipes are shared across
    // every property Racquel owns -- migration 072).
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, kosher_type, recipe_property_links!inner(property_id)')
      .eq('recipe_property_links.property_id', propertyId);

    if (recipesError || !recipes) {
      return Response.json({ error: recipesError?.message || 'No recipes found' }, { status: 400 });
    }

    const recipeIds = recipes.map((r: any) => r.id);
    const recipeKosherMap = new Map(recipes.map((r: any) => [r.id, r.kosher_type]));

    // Fetch all recipe_ingredients for these recipes. PostgREST caps a
    // single request at 1000 rows regardless of .limit(), so classification
    // must be computed from the complete set — paginate until exhausted,
    // otherwise an ingredient whose occurrences span the page boundary gets
    // classified from a partial view (e.g. missing the one Parve recipe
    // that should have made it "general" instead of "strictly kosher").
    const allIngredients: RecipeIngredientRow[] = [];
    {
      const pageSize = 1000;
      let from = 0;
      while (allIngredients.length < limit) {
        const { data: page, error: fetchError } = await supabase
          .from('recipe_ingredients')
          .select('id, name, recipe_id')
          .in('recipe_id', recipeIds)
          .range(from, from + pageSize - 1);

        if (fetchError) {
          return Response.json({ error: fetchError.message }, { status: 500 });
        }
        if (!page || page.length === 0) break;

        allIngredients.push(...(page as any[]));
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }

    if (allIngredients.length === 0) {
      return Response.json({ message: 'No ingredients found', updates: [] });
    }

    // Group ingredients by name and collect their recipes' kosher types
    const ingredientMap = new Map<string, IngredientWithContext>();

    for (const ing of allIngredients as any[]) {
      if (!ingredientMap.has(ing.name)) {
        ingredientMap.set(ing.name, {
          name: ing.name,
          recipeIds: [],
          recipeKosherTypes: [],
        });
      }

      const ctx = ingredientMap.get(ing.name)!;
      ctx.recipeIds.push(ing.recipe_id);

      const kosherType = recipeKosherMap.get(ing.recipe_id);
      if (kosherType && !ctx.recipeKosherTypes.includes(kosherType)) {
        ctx.recipeKosherTypes.push(kosherType);
      }
    }

    // Build recommendations and prepare updates
    const updates: Array<{
      ingredientName: string;
      reorder_link: string;
      primary_store: string;
      alternative_stores: string[];
      is_strictly_kosher: boolean;
      reasoning: string;
      affectedRows: number;
    }> = [];

    // Supabase's query builder is thenable but not a literal Promise
    // instance (missing catch/finally/Symbol.toStringTag per TS's
    // structural check) -- PromiseLike is the correct type for what's
    // actually pushed here, and Promise.allSettled accepts it fine.
    const updatePromises: PromiseLike<any>[] = [];

    for (const [name, context] of ingredientMap.entries()) {
      const recommendation = buildShoppingLinkRecommendation(context);
      const altUrls = getAllAlternativeUrls(name, recommendation.is_strictly_kosher);

      // Convert alternative store names to string array
      const altStoreNames = recommendation.alternative_stores;

      updates.push({
        ingredientName: name,
        reorder_link: recommendation.reorder_link,
        primary_store: recommendation.primary_store,
        alternative_stores: altStoreNames,
        is_strictly_kosher: recommendation.is_strictly_kosher,
        reasoning: recommendation.reasoning,
        affectedRows: context.recipeIds.length,
      });

      // Queue update (unless dry-run)
      // Update all recipe_ingredients with this name across all recipes
      if (!dryRun) {
        updatePromises.push(
          supabase
            .from('recipe_ingredients')
            .update({
              reorder_link: recommendation.reorder_link,
              primary_store: recommendation.primary_store,
              alternative_stores: altStoreNames,
              is_strictly_kosher: recommendation.is_strictly_kosher,
            })
            .eq('name', name)
        );
      }
    }

    // Execute all updates in parallel
    if (!dryRun && updatePromises.length > 0) {
      const results = await Promise.allSettled(updatePromises);
      const failures = results.filter(r => r.status === 'rejected');

      if (failures.length > 0) {
        return Response.json(
          {
            error: `${failures.length} updates failed`,
            updates,
            failures: failures.map(f => f.reason),
          },
          { status: 207 } // Multi-status
        );
      }
    }

    return Response.json({
      message: dryRun ? 'Dry run complete' : 'Updates applied',
      dryRun,
      totalIngredients: ingredientMap.size,
      totalRows: allIngredients.length,
      updates: updates.sort((a, b) => b.affectedRows - a.affectedRows), // Sort by impact
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
