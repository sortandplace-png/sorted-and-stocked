// app/properties/[id]/tools/photo-worklist/page.tsx
import PhotoWorklistClient from '@/components/PhotoWorklistClient';

export default async function PhotoWorklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotoWorklistClient propertyId={id} />;
}
