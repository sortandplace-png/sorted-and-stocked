// app/properties/[id]/tools/training/page.tsx
// Training Videos moved to /staff/training. Stub kept so existing links and
// bookmarks redirect instead of 404ing.
import { redirect } from 'next/navigation';

export default async function ToolsTrainingRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/properties/${id}/staff/training`);
}
