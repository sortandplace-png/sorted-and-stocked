// app/properties/[id]/tools/recipe-stealer/page.tsx
import RecipeScannerClient from '@/components/RecipeScannerClient';

export default async function RecipeStealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeScannerClient propertyId={id} />;
}
