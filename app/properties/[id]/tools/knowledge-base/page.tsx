// app/properties/[id]/tools/knowledge-base/page.tsx
import HouseholdKnowledgeClient from '@/components/HouseholdKnowledgeClient';

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HouseholdKnowledgeClient propertyId={id} />;
}
