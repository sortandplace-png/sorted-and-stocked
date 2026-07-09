'use server';

import { createClient } from '@supabase/supabase-js';

export async function fetchRecipeWithIngredients(recipeId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, name, name_es, photo_url, instructions_en, instructions_es, kosher_type, course, servings, family_notes, tags, approx_total_minutes, prep_lead_days')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    throw new Error('Could not load recipe');
  }

  // Fetch ingredients with shopping link data
  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('id, name, quantity, unit, category, reorder_link, primary_store, alternative_stores, is_strictly_kosher, photo_url, section_label')
    .eq('recipe_id', recipeId)
    .order('section_label', { nullsFirst: true })
    .order('category');

  if (ingredientError) {
    console.error('Ingredient fetch error:', ingredientError);
    return { recipe, ingredients: [] };
  }

  return { recipe, ingredients: ingredients || [] };
}
