// app/api/batch-shopping-links/route.ts
// SS work_items Tier 0, item 0.1. This route (and its three batch-update-*
// siblings) had no session or property-membership check at all -- any POST
// with a truthy propertyId ran against the service-role client, which
// bypasses RLS entirely. Gated the same way every other tools/* route in
// this app already is: a real cookie-bound session, then owner/manager on
// the specific propertyId requested. The service-role client below is kept
// for the actual batch work (recipe_ingredients has no per-user write
// policy shaped for this), but only ever reached after that gate passes.
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
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
  reorder_link: string | null;
  recipes?: { kosher_type?: string };
}

export async function POST(request: Request) {
  try {
    const { propertyId, dryRun = false, limit = 500 } = await request.json();

    if (!propertyId) {
      return Response.json({ error: 'propertyId required' }, { status: 400 });
    }

    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 });

    const { data: membership } = await authClient
      .from('property_members')
      .select('role')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membership?.role !== 'owner' && membership?.role !== 'manager') {
      return Response.json({ error: 'Owner or manager only.' }, { status: 403 });
    }

    // Use service role key to bypass RLS for batch operations
    const supabase = createServiceClient(
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
          .select('id, name, recipe_id, reorder_link')
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
    // First-seen reorder_link per ingredient name -- an audit "before"
    // value. Rows sharing a name can already disagree (never batch-applied
    // before), so this is a representative sample, not a per-row diff.
    const priorReorderLink = new Map<string, string | null>();

    for (const ing of allIngredients as any[]) {
      if (!ingredientMap.has(ing.name)) {
        ingredientMap.set(ing.name, {
          name: ing.name,
          recipeIds: [],
          recipeKosherTypes: [],
        });
        priorReorderLink.set(ing.name, ing.reorder_link ?? null);
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

      // Queue update (unless dry-run). Scoped to context.recipeIds -- the
      // specific recipe_ingredients rows already confirmed to belong to
      // this property's own recipes -- not .eq('name', name), which would
      // update every row sharing that ingredient name across every
      // property in the database (recipes are shared cross-property, so a
      // name match alone says nothing about which property's data this
      // request is authorized to touch).
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
            .in('recipe_id', context.recipeIds)
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

      // Audit trail (batch-operations UI requirement) -- one row per
      // ingredient actually written, not per recipe_ingredients row, same
      // granularity as `updates` above. inventory_item_id is left null:
      // this table's usual subject, but nullable, and there's no more
      // fitting existing log for a recipe_ingredients change than the one
      // built for property-level item history with the acting user already
      // wired in.
      const historyRows = updates.map((u) => ({
        property_id: propertyId,
        inventory_item_id: null,
        item_name_snapshot: u.ingredientName,
        action_type: 'batch_shopping_link_update',
        actor_user_id: user.id,
        field_name: 'reorder_link',
        old_value: priorReorderLink.get(u.ingredientName) ?? null,
        new_value: u.reorder_link,
      }));
      const { error: historyError } = await supabase.from('inventory_item_history').insert(historyRows);
      if (historyError) {
        console.error('[batch-shopping-links] history logging failed:', historyError.message);
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
