// app/properties/[id]/meal-plan/page.tsx
import { createClient } from '@/lib/supabase/server';
import MealPlanView from '@/components/meal-plan/MealPlanView';

export default async function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, name_es, photo_url, course, kosher_type, is_shabbos_only')
    .eq('property_id', id)
    .order('name');

  return <MealPlanView propertyId={id} recipes={recipes || []} />;
}
