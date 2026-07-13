import type { SupabaseClient } from '@supabase/supabase-js';

export type RecipeDeleteBlocker = {
  table: string;
  count: number;
  description: string;
};

export type RecipeDeleteCheck =
  | { deletable: true }
  | { deletable: false; blockers: RecipeDeleteBlocker[]; message: string };

// recipe_ingredients and recipe_versions are intrinsic to the recipe itself
// (its own ingredient list and edit history) and are ON DELETE CASCADE at
// the DB level by design -- deliberately excluded here, since blocking on
// them would make almost any recipe with edit history permanently
// undeletable. The four below are real usage *elsewhere* in the app that a
// delete would otherwise break silently: meal_plan_entries sets recipe_id
// to NULL (a meal plan slot goes blank with no warning), recipe_substitutions
// and shopping_list_item_sources cascade-delete with no warning, and
// recipe_favorites already hard-blocks at the DB level but surfaces as a
// raw FK error instead of a message a user can act on.
const REFERENCE_CHECKS: {
  table: string;
  describe: (count: number) => string;
}[] = [
  { table: 'meal_plan_entries', describe: (n) => `used in ${n} meal plan ${n === 1 ? 'entry' : 'entries'}` },
  { table: 'recipe_favorites', describe: (n) => `favorited by ${n} ${n === 1 ? 'person' : 'people'}` },
  { table: 'recipe_substitutions', describe: (n) => `has ${n} saved substitution ${n === 1 ? 'note' : 'notes'}` },
  { table: 'shopping_list_item_sources', describe: (n) => `linked from ${n} shopping list ${n === 1 ? 'item' : 'items'}` },
];

export async function checkRecipeDeletable(
  supabase: SupabaseClient,
  recipeId: string
): Promise<RecipeDeleteCheck> {
  const blockers: RecipeDeleteBlocker[] = [];

  for (const check of REFERENCE_CHECKS) {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', recipeId);

    if (error || !count) continue;

    blockers.push({ table: check.table, count, description: check.describe(count) });
  }

  if (blockers.length === 0) {
    return { deletable: true };
  }

  const message =
    `This recipe is ${blockers.map((b) => b.description).join(' and ')} — ` +
    `remove those first, or choose a replacement recipe to repoint them to before deleting.`;

  return { deletable: false, blockers, message };
}
