// app/properties/[id]/meal-plan/page.tsx
import MealPlanClient from '@/components/MealPlanClient';

export default async function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MealPlanClient propertyId={id} />;
}
