// app/properties/[id]/tools/memory-timeline/page.tsx
import HomeMemoryTimelineClient from '@/components/HomeMemoryTimelineClient';

export default async function MemoryTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HomeMemoryTimelineClient propertyId={id} />;
}
