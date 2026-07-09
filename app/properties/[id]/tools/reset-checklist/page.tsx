// app/properties/[id]/tools/reset-checklist/page.tsx
import ResetChecklistClient from '@/components/ResetChecklistClient';

export default async function ResetChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResetChecklistClient propertyId={id} />;
}
