// app/properties/[id]/shift-handover/page.tsx
import ShiftHandoverClient from '@/components/ShiftHandoverClient';

export default async function ShiftHandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShiftHandoverClient propertyId={id} />;
}
