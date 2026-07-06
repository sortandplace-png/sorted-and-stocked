// app/properties/[id]/tools/price-scanner/page.tsx
import PhotoToolClient from '@/components/PhotoToolClient';

export default async function PriceScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PhotoToolClient
      propertyId={id}
      title="Price Scanner"
      description="Photograph or type in a product to find a cheaper equivalent."
      apiRoute="/api/tools/price-scanner"
      actionLabel="Take or upload a photo"
      textPlaceholder="e.g. Heinz Tomato Ketchup 32oz"
    />
  );
}
