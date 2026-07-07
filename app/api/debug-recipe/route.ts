import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipeId = searchParams.get('recipeId');
  const recipeName = searchParams.get('recipe') || 'sesame teriyaki';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let recipe;

  if (recipeId) {
    // Direct lookup by ID
    const { data } = await supabase
      .from('recipes')
      .select('id, name')
      .eq('id', recipeId)
      .single();
    recipe = data;
  } else {
    // Lookup by name
    const { data } = await supabase
      .from('recipes')
      .select('id, name')
      .ilike('name', `%${recipeName}%`)
      .single();
    recipe = data;
  }

  if (!recipe) {
    return Response.json({ error: 'Recipe not found', searchedRecipe: recipeName || recipeId });
  }

  // Get ingredients - no filters, using service role
  const { data: ingredients, error } = await supabase
    .from('recipe_ingredients')
    .select('id, name, quantity, unit, primary_store, reorder_link, photo_url')
    .eq('recipe_id', recipe.id);

  return Response.json({
    recipe,
    error,
    ingredientCount: ingredients?.length || 0,
    ingredients: ingredients || [],
  });
}
