'use server';

import { createClient } from '@/lib/supabase/server';

interface UpdateSubstitutionInput {
  recipeId: string;
  notes: string;
  updatedBy: string;
}

export async function updateRecipeSubstitution({
  recipeId,
  notes,
  updatedBy,
}: UpdateSubstitutionInput): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Verify recipe exists
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', recipeId)
      .single();

    if (recipeError || !recipe) {
      return { success: false, error: 'Recipe not found.' };
    }

    // Upsert: create if new, update if exists
    const { error: upsertError } = await supabase
      .from('recipe_substitutions')
      .upsert({
        recipe_id: recipeId,
        notes,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'recipe_id',
      });

    if (upsertError) {
      console.error('Substitution upsert failed:', upsertError);
      return { success: false, error: 'Failed to save substitution notes.' };
    }

    return { success: true };
  } catch (error) {
    console.error('RecipeSubstitution update failed:', error);
    return { success: false, error: 'Database transaction failed.' };
  }
}
