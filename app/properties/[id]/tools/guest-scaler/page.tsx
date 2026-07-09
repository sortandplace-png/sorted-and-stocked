// app/properties/[id]/tools/guest-scaler/page.tsx
import GuestScalerClient from '@/components/GuestScalerClient';

export default async function GuestScalerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestScalerClient propertyId={id} />;
}
