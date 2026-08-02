// app/properties/[id]/recipes/page.tsx
import { createClient } from '@/lib/supabase/server';
import RecipesGridView from '@/components/recipes/RecipesGridView';
import { isOperatorConsole } from '@/lib/module-flags';

const RECIPE_FIELDS =
  'id, name, name_es, photo_url, kosher_type, course, tags, is_pesach, is_yom_tov, is_shabbos_only, approx_total_minutes, created_at, new_badge_until';

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase.from('properties').select('feature_flags').eq('id', id).single();

  // LAX OPERATOR AGGREGATE: on the operator-console property only, the
  // grid spans every property the signed-in operator is a member of,
  // queried by recipes.property_id (the recipe's HOME) -- deliberately
  // NOT by backfilling recipe_property_links, which would erase the
  // source tag this view exists to show. Each card carries a source
  // badge and opens in its home property, so an edit always happens
  // where the recipe lives.
  if (isOperatorConsole(property?.feature_flags as Record<string, unknown> | null)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: memberships } = user
      ? await supabase.from('property_members').select('property_id').eq('user_id', user.id)
      : { data: null };
    const memberPropertyIds = (memberships ?? []).map((m) => m.property_id);

    const { data: recipes } = memberPropertyIds.length
      ? await supabase
          .from('recipes')
          .select(`${RECIPE_FIELDS}, property_id, properties(name)`)
          .in('property_id', memberPropertyIds)
          .order('name')
      : { data: [] };

    const aggregated = (recipes ?? []).map((r) => ({
      ...r,
      source_property_id: r.property_id as string,
      source_property_name: ((r.properties as unknown as { name: string } | null)?.name ?? null) as string | null,
    }));

    return <RecipesGridView propertyId={id} recipes={aggregated} aggregateView />;
  }

  // Recipes are shared across every property Racquel owns (migration 072) --
  // filtered through recipe_property_links rather than recipes.property_id
  // directly, since a recipe's "home" property is no longer the only one
  // it's visible from.
  const { data: recipes } = await supabase
    .from('recipes')
    .select(`${RECIPE_FIELDS}, recipe_property_links!inner(property_id)`)
    .eq('recipe_property_links.property_id', id)
    .order('name');

  return <RecipesGridView propertyId={id} recipes={recipes || []} />;
}
