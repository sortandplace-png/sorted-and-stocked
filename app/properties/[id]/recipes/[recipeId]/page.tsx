// app/properties/[id]/recipes/[recipeId]/page.tsx
import RecipeDetailClient from '@/components/RecipeDetailClient';
import { createClient } from '@/lib/supabase/server';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string; recipeId: string }>;
}) {
  const { id, recipeId } = await params;
  const supabase = await createClient();

  // Fetch recipe and substitution data
  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, name')
    .eq('id', recipeId)
    .single();

  const { data: substitution } = await supabase
    .from('recipe_substitutions')
    .select('notes, updated_at, updated_by')
    .eq('recipe_id', recipeId)
    .single();

  return (
    <RecipeDetailClient
      propertyId={id}
      recipeId={recipeId}
      recipeName={recipe?.name || ''}
      substitutionNotes={substitution?.notes || null}
      substitutionUpdatedAt={substitution?.updated_at}
      substitutionUpdatedBy={substitution?.updated_by}
    />
  );
}
