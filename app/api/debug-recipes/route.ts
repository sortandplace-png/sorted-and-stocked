import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('property') || 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name')
    .eq('property_id', propertyId)
    .like('name', '%muffin%');

  // Get all ingredients with reorder_link
  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, name, primary_store')
    .not('reorder_link', 'is', null)
    .limit(10);

  return Response.json({
    recipes: recipes || [],
    sampleIngredientsWithLinks: ingredients || [],
  });
}
