// app/properties/[id]/meal-plan/page.tsx
import { createClient } from '@/lib/supabase/server';
import MealPlanTabs from '@/components/MealPlanTabs';

export default async function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch meal plan entries for the calendar viewer
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: entries } = await supabase
    .from('meal_plan_entries')
    .select(`
      id,
      plan_date,
      meal_slot,
      course,
      custom_name,
      recipes(id, name, kosher_type)
    `)
    .eq('property_id', id)
    .gte('plan_date', todayStr)
    .order('plan_date');

  return <MealPlanTabs propertyId={id} initialEntries={entries || []} />;
}
