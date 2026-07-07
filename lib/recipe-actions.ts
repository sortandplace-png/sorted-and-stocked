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
    .select('id, name, name_es, photo_url, instructions_en, instructions_es, kosher_type, course, servings')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    throw new Error('Could not load recipe');
  }

  // Fetch ingredients with shopping link data
  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('id, name, quantity, unit, category, reorder_link, primary_store, alternative_stores, is_strictly_kosher, photo_url')
    .eq('recipe_id', recipeId)
    .order('category');

  if (ingredientError) {
    console.error('Ingredient fetch error:', ingredientError);
    return { recipe, ingredients: [] };
  }

  return { recipe, ingredients: ingredients || [] };
}
