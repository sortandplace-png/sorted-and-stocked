// app/properties/[id]/tools/needs-linking/page.tsx
import NeedsLinkingClient from '@/components/NeedsLinkingClient';

export default async function NeedsLinkingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NeedsLinkingClient propertyId={id} />;
}
