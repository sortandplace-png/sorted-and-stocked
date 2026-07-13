// app/properties/[id]/tools/capture-inbox/page.tsx
import CaptureInboxClient from '@/components/CaptureInboxClient';

export default async function CaptureInboxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaptureInboxClient propertyId={id} />;
}
