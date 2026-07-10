// app/properties/[id]/tools/ingredient-scanner/page.tsx
import IngredientScannerClient from '@/components/IngredientScannerClient';

export default async function IngredientScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IngredientScannerClient propertyId={id} />;
}
