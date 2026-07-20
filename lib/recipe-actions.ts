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
  // inventory_item_id added here after an earlier verification miss on my
  // part: I'd checked information_schema's FK constraints, found none on
  // this column (it genuinely has no FK defined), and concluded the column
  // didn't exist at all. It does -- confirmed live, 2,244 of 2,364 rows
  // (95%) are already linked. The FK-constraint check was the wrong query
  // for the question "does this column exist."
  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('id, name, name_es, quantity, unit, category, reorder_link, primary_store, alternative_stores, is_strictly_kosher, photo_url, section_label, inventory_item_id')
    .eq('recipe_id', recipeId)
    .order('section_label', { nullsFirst: true })
    .order('category');

  if (ingredientError) {
    console.error('Ingredient fetch error:', ingredientError);
    return { recipe, ingredients: [] };
  }

  // Two-tier fallback for an ingredient missing its own photo_url,
  // reorder_link, or name_es: prefer the real inventory_item_id link (95%
  // of rows have one -- a direct, unambiguous match), then fall back to a
  // name match against the property's inventory for the remaining ~5%
  // that aren't linked yet. An ingredient whose own reorder_link was null
  // rendered with no cart icon at all even when its linked inventory item
  // had a real, correct one (the Kosher West / Gourmet Glatt links) -- not
  // a component regression, IngredientShoppingLink always only read the
  // ingredient's own field; there was never a fallback to the link.
  const rows = ingredients ?? [];
  const needsFallback = rows.some((i) => !i.photo_url || !i.reorder_link || !i.name_es);

  if (needsFallback) {
    type InvFields = { id: string; name: string; name_es: string | null; photo_url: string | null; reorder_link: string | null };

    const linkedIds = [...new Set(rows.filter((i) => !!i.inventory_item_id).map((i) => i.inventory_item_id as string))];
    const byId = new Map<string, InvFields>();
    if (linkedIds.length > 0) {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, name_es, photo_url, reorder_link')
        .in('id', linkedIds);
      for (const row of data ?? []) byId.set(row.id, row);
    }

    const unlinkedNeedFallback = rows.some(
      (i) => !i.inventory_item_id && (!i.photo_url || !i.reorder_link || !i.name_es)
    );
    const byName = new Map<string, InvFields>();
    if (propertyId && unlinkedNeedFallback) {
      // Paginated in batches of 1000 -- a plain unpaginated .select() here
      // hits the same silent PostgREST row cap addIngredientsToShoppingList
      // already guards against, and Main alone is past it (1,129 items).
      for (let offset = 0; ; offset += 1000) {
        const { data } = await supabase
          .from('inventory_items')
          .select('id, name, name_es, photo_url, reorder_link')
          .eq('property_id', propertyId)
          .range(offset, offset + 999);
        for (const row of data ?? []) byName.set(row.name.trim().toLowerCase(), row);
        if (!data || data.length < 1000) break;
      }
    }

    for (const ingredient of rows) {
      const match = (ingredient.inventory_item_id && byId.get(ingredient.inventory_item_id)) || byName.get(ingredient.name.trim().toLowerCase());
      if (!match) continue;
      if (!ingredient.photo_url && match.photo_url) ingredient.photo_url = match.photo_url;
      if (!ingredient.reorder_link && match.reorder_link) ingredient.reorder_link = match.reorder_link;
      if (!ingredient.name_es && match.name_es) ingredient.name_es = match.name_es;
    }
  }

  return { recipe, ingredients: rows };
}
