// app/properties/[id]/tools/recipe-stealer/page.tsx
import PhotoToolClient from '@/components/PhotoToolClient';

export default async function RecipeStealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PhotoToolClient
      propertyId={id}
      title="Copycat Recipe"
      description="Photograph or describe a dish to get a home-cookable version."
      apiRoute="/api/tools/recipe-stealer"
      actionLabel="Take or upload a photo of a dish"
      textPlaceholder="e.g. Cheesecake Factory's Louisiana chicken pasta"
    />
  );
}
