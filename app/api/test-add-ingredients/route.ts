import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { recipeName, propertyId, ingredients } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find recipe by name
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id')
      .eq('property_id', propertyId)
      .ilike('name', `%${recipeName}%`)
      .single();

    if (recipeError || !recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Insert ingredients WITH shopping links
    const ingredientRows = ingredients.map((ing: any) => ({
      recipe_id: recipe.id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      category: ing.category,
      // Set default shopping links (general items -> Instacart + Costco)
      primary_store: 'instacart_costco',
      reorder_link: `https://www.instacart.com/store/costco/search?q=${encodeURIComponent(ing.name)}`,
      alternative_stores: ['instacart_walmart', 'instacart_target', 'amazon', 'walmart', 'target'],
      is_strictly_kosher: false,
    }));

    const { data, error: insertError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientRows)
      .select();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({
      message: `Added ${data.length} ingredients to ${recipeName}`,
      recipeId: recipe.id,
      ingredients: data,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
