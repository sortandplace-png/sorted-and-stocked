// lib/shopping-list-actions.ts
// Shared "add ingredients to the active shopping list" logic — used by both
// the meal-plan week generator and the per-ingredient "add to list" button
// on the recipe detail page. Handles finding-or-creating the active list
// (race-condition-safe against the unique index on (property_id) WHERE
// status='active') and writing shopping_list_item_sources rows so the
// items show up correctly attributed under "By Recipe" on the shopping list.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IngredientToAdd {
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  recipe_id: string | null;
}

export async function addIngredientsToShoppingList(
  supabase: SupabaseClient,
  propertyId: string,
  ingredients: IngredientToAdd[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (ingredients.length === 0) {
    return { ok: false, error: 'No ingredients to add.' };
  }

  let { data: list } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!list) {
    const { data: created, error: createError } = await supabase
      .from('shopping_lists')
      .insert({ property_id: propertyId, name: 'Shopping List', status: 'active' })
      .select('id')
      .single();

    if (createError?.code === '23505') {
      const { data: existing } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('property_id', propertyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!existing) return { ok: false, error: 'Failed to create shopping list.' };
      list = existing;
    } else if (createError || !created) {
      return { ok: false, error: 'Failed to create shopping list.' };
    } else {
      list = created;
    }
  }

  const rows = ingredients.map((ing) => ({
    shopping_list_id: list!.id,
    name: ing.quantity ? `${ing.name} (${ing.quantity}${ing.unit ? ' ' + ing.unit : ''})` : ing.name,
    category: ing.category,
    qty_needed: 1,
    status: 'pending' as const,
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from('shopping_list_items')
    .insert(rows)
    .select('id');

  if (insertError || !insertedItems) {
    return { ok: false, error: 'Failed to add ingredients.' };
  }

  const sourceRows = insertedItems
    .map((item, i) => ({
      shopping_list_item_id: item.id,
      recipe_id: ingredients[i].recipe_id,
      quantity: ingredients[i].quantity,
      unit: ingredients[i].unit,
    }))
    .filter((row) => row.recipe_id);

  if (sourceRows.length > 0) {
    await supabase.from('shopping_list_item_sources').insert(sourceRows);
  }

  return { ok: true, count: insertedItems.length };
}
