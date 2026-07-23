// app/properties/[id]/page.tsx
import { redirect } from 'next/navigation';

export default async function PropertyRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/properties/${id}/dashboard`);
}
