// app/properties/[id]/yom-tov/page.tsx
import YomTovYearClient from '@/components/YomTovYearClient';

export default async function YomTovYearPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <YomTovYearClient propertyId={id} />;
}
