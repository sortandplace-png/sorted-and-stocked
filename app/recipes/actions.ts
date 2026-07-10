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

interface UpdateBrachaCategoryInput {
  recipeId: string;
  brachaCategory: string | null;
}

// Mechanical achrona derivation from an already-set rishona category --
// mirrors migration 048_derive_bracha_achrona.sql exactly, so a recipe's
// achrona stays correct going forward whenever its category is changed
// here, not just as a one-time backfill. The rishona classification
// itself is a human decision (the dropdown this feeds); this only maps
// achrona on top of it for the uncontested cases. Only the 5 tree-fruit
// "shivat haminim" species get Al Ha'eitz -- everything else falls to
// the uncontested Borei Nefashos catch-all. Returns null (and the caller
// sets needsSourcing = true) for anything not covered here, rather than
// guessing.
const SEVEN_SPECIES_TREE_FRUIT = /\b(grapes?|figs?|pomegranates?|olives?|dates?)\b/i;

function deriveBrachaAchrona(category: string | null, recipeName: string): string | null {
  if (!category) return null;
  if (category === 'bread') return 'Birkat Hamazon';
  if (category === 'grain_mezonos') return 'Al Hamichyah';
  if (category === 'wine_grape_juice') return 'Al Hagefen';
  if (category === 'tree_fruit') {
    return SEVEN_SPECIES_TREE_FRUIT.test(recipeName) ? "Al Ha'eitz" : 'Borei Nefashos';
  }
  if (['ground_produce', 'meat_fish_dairy_eggs', 'beverages_other'].includes(category)) {
    return 'Borei Nefashos';
  }
  return null;
}

export async function updateRecipeBrachaCategory({
  recipeId,
  brachaCategory,
}: UpdateBrachaCategoryInput): Promise<{
  success: boolean;
  error?: string;
  achrona?: string | null;
  needsSourcing?: boolean;
}> {
  try {
    const supabase = await createClient();

    const { data: recipe } = await supabase.from('recipes').select('name').eq('id', recipeId).single();
    const achrona = brachaCategory ? deriveBrachaAchrona(brachaCategory, recipe?.name ?? '') : null;
    const needsSourcing = !!brachaCategory && achrona === null;

    const { error } = await supabase
      .from('recipes')
      .update({
        bracha_category: brachaCategory,
        bracha_achrona: achrona,
        bracha_needs_sourcing: needsSourcing,
      })
      .eq('id', recipeId);

    if (error) {
      console.error('Bracha category update failed:', error);
      return { success: false, error: 'Failed to save bracha.' };
    }

    return { success: true, achrona, needsSourcing };
  } catch (error) {
    console.error('Bracha category update failed:', error);
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
