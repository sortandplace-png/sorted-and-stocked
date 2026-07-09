// app/properties/[id]/tools/pantry-zones/page.tsx
import PantryZonesClient from '@/components/PantryZonesClient';

export default async function PantryZonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PantryZonesClient propertyId={id} />;
}
