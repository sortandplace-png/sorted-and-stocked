import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { recipeName, propertyId } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id')
      .eq('property_id', propertyId)
      .ilike('name', `%${recipeName}%`)
      .single();

    if (recipeError || !recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Get all ingredients for this recipe
    const { data: ingredients } = await supabase
      .from('recipe_ingredients')
      .select('id, name')
      .eq('recipe_id', recipe.id);

    if (!ingredients || ingredients.length === 0) {
      return Response.json({ error: 'No ingredients found' }, { status: 404 });
    }

    // Update each ingredient with shopping links
    const updates = ingredients.map((ing: any) => ({
      id: ing.id,
      primary_store: 'instacart_costco',
      reorder_link: `https://www.instacart.com/store/costco/search?q=${encodeURIComponent(ing.name)}`,
      alternative_stores: ['instacart_walmart', 'instacart_target', 'amazon', 'walmart', 'target'],
      is_strictly_kosher: false,
    }));

    // Batch update
    for (const update of updates) {
      await supabase
        .from('recipe_ingredients')
        .update({
          primary_store: update.primary_store,
          reorder_link: update.reorder_link,
          alternative_stores: update.alternative_stores,
          is_strictly_kosher: update.is_strictly_kosher,
        })
        .eq('id', update.id);
    }

    return Response.json({
      message: `Updated ${updates.length} ingredients with shopping links`,
      count: updates.length,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
