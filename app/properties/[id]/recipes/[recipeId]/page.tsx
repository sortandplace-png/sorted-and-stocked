// app/properties/[id]/recipes/[recipeId]/page.tsx
import RecipeDetailClient from '@/components/RecipeDetailClient';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string; recipeId: string }>;
}) {
  const { id, recipeId } = await params;
  return <RecipeDetailClient propertyId={id} recipeId={recipeId} />;
}
