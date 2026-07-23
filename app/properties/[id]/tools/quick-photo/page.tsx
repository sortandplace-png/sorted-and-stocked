// app/properties/[id]/tools/quick-photo/page.tsx
import QuickPhotoCaptureClient from '@/components/QuickPhotoCaptureClient';

export default async function QuickPhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuickPhotoCaptureClient propertyId={id} />;
}
