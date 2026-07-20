'use server';

import { createClient } from '@supabase/supabase-js';

export async function fetchRecipeWithIngredients(recipeId: string, propertyId?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, name, name_es, photo_url, instructions_en, instructions_es, kosher_type, course, servings, family_notes, notes, equipment, bracha_category, bracha_achrona, bracha_achrona_note, bracha_needs_sourcing, tags, approx_total_minutes, prep_lead_days, is_shabbos_only, is_yom_tov, is_pesach')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    throw new Error('Could not load recipe');
  }

  // Fetch ingredients with shopping link data
  // name_es added for SS-146 -- was missing from this select entirely, so
  // every ingredient's name_es read as undefined at runtime regardless of
  // what's actually in the column (confirmed live: 2355/2355 rows
  // populated), even though the Ingredient type below already declared it.
  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('id, name, name_es, quantity, unit, category, reorder_link, primary_store, alternative_stores, is_strictly_kosher, photo_url, section_label')
    .eq('recipe_id', recipeId)
    .order('section_label', { nullsFirst: true })
    .order('category');

  if (ingredientError) {
    console.error('Ingredient fetch error:', ingredientError);
    return { recipe, ingredients: [] };
  }

  // recipe_ingredients has no stored inventory_item_id (only shopping_list_items
  // and staples do) -- same name-matched fallback migration 073 already
  // established for the shopping list's own photo gap, applied here so an
  // ingredient with no photo of its own can still show the linked pantry
  // item's real photo instead of nothing. Only queries when there's
  // actually a gap to fill, and only for names within this recipe.
  const missingPhotoNames = (ingredients ?? [])
    .filter((i) => !i.photo_url)
    .map((i) => i.name.trim().toLowerCase());

  if (propertyId && missingPhotoNames.length > 0) {
    const { data: matches } = await supabase
      .from('inventory_items')
      .select('name, photo_url')
      .eq('property_id', propertyId)
      .not('photo_url', 'is', null);

    const photoByName = new Map(
      (matches ?? []).map((m) => [m.name.trim().toLowerCase(), m.photo_url])
    );

    for (const ingredient of ingredients ?? []) {
      if (!ingredient.photo_url) {
        ingredient.photo_url = photoByName.get(ingredient.name.trim().toLowerCase()) ?? null;
      }
    }
  }

  return { recipe, ingredients: ingredients || [] };
}
