// app/properties/[id]/bulk-photos/page.tsx
import BulkPhotoUploadClient from '@/components/BulkPhotoUploadClient';

export default async function BulkPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BulkPhotoUploadClient propertyId={id} />;
}
