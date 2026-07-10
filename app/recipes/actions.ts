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

interface UpdateFamilyNotesInput {
  recipeId: string;
  notes: string;
}

export async function updateRecipeFamilyNotes({
  recipeId,
  notes,
}: UpdateFamilyNotesInput): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('recipes').update({ family_notes: notes }).eq('id', recipeId);

    if (error) {
      console.error('Family notes update failed:', error);
      return { success: false, error: 'Failed to save family notes.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Family notes update failed:', error);
    return { success: false, error: 'Database transaction failed.' };
  }
}

interface UpdateEquipmentInput {
  recipeId: string;
  equipment: string[];
}

export async function updateRecipeEquipment({
  recipeId,
  equipment,
}: UpdateEquipmentInput): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('recipes').update({ equipment }).eq('id', recipeId);

    if (error) {
      console.error('Equipment update failed:', error);
      return { success: false, error: 'Failed to save kitchen tools.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Equipment update failed:', error);
    return { success: false, error: 'Database transaction failed.' };
  }
}

interface UpdatePrepLeadDaysInput {
  recipeId: string;
  prepLeadDays: number | null;
}

export async function updateRecipePrepLeadDays({
  recipeId,
  prepLeadDays,
}: UpdatePrepLeadDaysInput): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('recipes')
      .update({ prep_lead_days: prepLeadDays })
      .eq('id', recipeId);

    if (error) {
      console.error('Prep lead days update failed:', error);
      return { success: false, error: 'Failed to save.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Prep lead days update failed:', error);
    return { success: false, error: 'Database transaction failed.' };
  }
}
