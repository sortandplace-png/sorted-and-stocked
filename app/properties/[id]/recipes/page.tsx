// app/properties/[id]/recipes/page.tsx
import { createClient } from '@/lib/supabase/server';
import RecipesGridView from '@/components/recipes/RecipesGridView';

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Recipes are shared across every property Racquel owns (migration 072) --
  // filtered through recipe_property_links rather than recipes.property_id
  // directly, since a recipe's "home" property is no longer the only one
  // it's visible from.
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, photo_url, kosher_type, course, tags, is_pesach, is_yom_tov, is_shabbos_only, approx_total_minutes, created_at, recipe_property_links!inner(property_id)')
    .eq('recipe_property_links.property_id', id)
    .order('name');

  return <RecipesGridView propertyId={id} recipes={recipes || []} />;
}
