// app/properties/[id]/tools/ingredient-scanner/page.tsx
import PhotoToolClient from '@/components/PhotoToolClient';

export default async function IngredientScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PhotoToolClient
      propertyId={id}
      title="Ingredient Scanner"
      description="Photograph or type in a label for a plain-language, evidence-based read."
      apiRoute="/api/tools/ingredient-scanner"
      actionLabel="Take or upload a photo of a label"
      textPlaceholder="e.g. Water, Sugar, Citric Acid, Sodium Benzoate..."
    />
  );
}
