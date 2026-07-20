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
  // established for the shopping list's own photo gap, extended here to
  // photo_url, reorder_link, and name_es together. An ingredient whose own
  // reorder_link was null rendered with no cart icon at all even when the
  // same-named inventory item had a real, correct one (the Kosher West /
  // Gourmet Glatt links) -- not a component regression, IngredientShoppingLink
  // always only read the ingredient's own field; there was never a fallback.
  // Only queries when there's an actual gap to fill.
  const needsFallback = (ingredients ?? []).some((i) => !i.photo_url || !i.reorder_link || !i.name_es);

  if (propertyId && needsFallback) {
    // Paginated in batches of 1000 -- a plain unpaginated .select() here
    // hits the same silent PostgREST row cap addIngredientsToShoppingList
    // already guards against, and Main alone is past it (1,129 items).
    const matches: { name: string; name_es: string | null; photo_url: string | null; reorder_link: string | null }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase
        .from('inventory_items')
        .select('name, name_es, photo_url, reorder_link')
        .eq('property_id', propertyId)
        .range(offset, offset + 999);
      matches.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const byName = new Map(matches.map((m) => [m.name.trim().toLowerCase(), m]));

    for (const ingredient of ingredients ?? []) {
      const match = byName.get(ingredient.name.trim().toLowerCase());
      if (!match) continue;
      if (!ingredient.photo_url && match.photo_url) ingredient.photo_url = match.photo_url;
      if (!ingredient.reorder_link && match.reorder_link) ingredient.reorder_link = match.reorder_link;
      if (!ingredient.name_es && match.name_es) ingredient.name_es = match.name_es;
    }
  }

  return { recipe, ingredients: ingredients || [] };
}
