import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find ALL recipe_ingredients (no filter)
  const { data: allIngredients, count } = await supabase
    .from('recipe_ingredients')
    .select('id, recipe_id, name', { count: 'exact' })
    .limit(100);

  // Find ALL recipes (no filter)
  const { data: allRecipes } = await supabase
    .from('recipes')
    .select('id, property_id, name')
    .limit(100);

  // Count ingredients by recipe
  const recipeIngredientCounts = new Map();
  if (allIngredients) {
    for (const ing of allIngredients) {
      recipeIngredientCounts.set(ing.recipe_id, (recipeIngredientCounts.get(ing.recipe_id) || 0) + 1);
    }
  }

  return Response.json({
    totalIngredients: count || 0,
    sampleIngredients: allIngredients || [],
    recipesWithMostIngredients: Array.from(recipeIngredientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([recipeId, count]) => ({
        recipeId,
        ingredientCount: count,
        recipe: allRecipes?.find(r => r.id === recipeId),
      })),
    allRecipesCount: allRecipes?.length || 0,
  });
}
