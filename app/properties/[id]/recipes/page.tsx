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

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, photo_url, kosher_type')
    .eq('property_id', id)
    .order('name');

  return <RecipesGridView propertyId={id} recipes={recipes || []} />;
}
