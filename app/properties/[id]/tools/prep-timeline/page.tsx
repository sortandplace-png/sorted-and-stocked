// app/properties/[id]/tools/prep-timeline/page.tsx
import PrepTimelineClient from '@/components/PrepTimelineClient';

export default async function PrepTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrepTimelineClient propertyId={id} />;
}
