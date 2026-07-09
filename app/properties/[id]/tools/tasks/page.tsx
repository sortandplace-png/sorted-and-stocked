// app/properties/[id]/tools/tasks/page.tsx
import StaffTasksClient from '@/components/StaffTasksClient';

export default async function StaffTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StaffTasksClient propertyId={id} />;
}
