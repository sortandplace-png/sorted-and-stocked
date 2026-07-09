// app/properties/[id]/tools/duplicate-ingredients/page.tsx
import DuplicateIngredientsClient from '@/components/DuplicateIngredientsClient';

export default async function DuplicateIngredientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DuplicateIngredientsClient propertyId={id} />;
}
