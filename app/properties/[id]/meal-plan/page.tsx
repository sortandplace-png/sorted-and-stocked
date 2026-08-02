// app/properties/[id]/meal-plan/page.tsx
import { createClient } from '@/lib/supabase/server';
import MealPlanView from '@/components/meal-plan/MealPlanView';
import OperatorMealPlanOverview, {
  type OperatorMealPlanHouse,
} from '@/components/meal-plan/OperatorMealPlanOverview';
import { isOperatorConsole } from '@/lib/module-flags';

// Same Eastern-anchored date technique the dashboard uses everywhere --
// format()/toISOString() with no timezone reads the server's own UTC
// clock and drifts a day on Eastern evenings.
function easternTodayStr(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export default async function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase.from('properties').select('feature_flags').eq('id', id).single();

  // LAX OPERATOR AGGREGATE: the operator-console property gets the
  // all-houses week overview -- grouped by property, one row per house
  // per day -- instead of the single-house planner. Read-only-safe: each
  // house links out to its own plan and edits happen there.
  if (isOperatorConsole(property?.feature_flags as Record<string, unknown> | null)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: memberships } = user
      ? await supabase.from('property_members').select('property_id, properties(name)').eq('user_id', user.id)
      : { data: null };

    const today = easternTodayStr();
    const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i));
    const memberProps = (memberships ?? []).map((m) => ({
      id: m.property_id as string,
      name: ((m.properties as unknown as { name: string } | null)?.name ?? 'Unknown') as string,
    }));

    const { data: entries } = memberProps.length
      ? await supabase
          .from('meal_plan_entries')
          .select('property_id, plan_date, custom_name, recipes(name)')
          .in('property_id', memberProps.map((p) => p.id))
          .gte('plan_date', weekDates[0])
          .lte('plan_date', weekDates[6])
          .order('plan_date')
      : { data: [] };

    const houses: OperatorMealPlanHouse[] = memberProps
      .map((p) => ({
        propertyId: p.id,
        propertyName: p.name,
        days: weekDates.map((date) => ({
          date,
          dishes: (entries ?? [])
            .filter((e) => e.property_id === p.id && e.plan_date === date)
            .map((e) => (e.recipes as unknown as { name: string } | null)?.name ?? e.custom_name ?? '')
            .filter(Boolean),
        })),
      }))
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName));

    return <OperatorMealPlanOverview houses={houses} />;
  }

  // Recipes are shared across every property Racquel owns (migration 072).
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, name_es, photo_url, course, kosher_type, is_shabbos_only, tags, approx_total_minutes, recipe_property_links!inner(property_id)')
    .eq('recipe_property_links.property_id', id)
    .order('name');

  return <MealPlanView propertyId={id} recipes={recipes || []} />;
}
