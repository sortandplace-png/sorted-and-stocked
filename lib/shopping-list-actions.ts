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

  // Match against real inventory so checking off a recipe-sourced item
  // actually updates stock counts (confirmed live: 15+ ingredient name
  // variants on the Needs Linking screen had zero inventory connection
  // because this was never set). Exact case-insensitive name match — the
  // same tier find_similar_inventory_items uses for its top match, without
  // pulling in its fuzzy-similarity scoring for what's meant to be a quiet
  // background link.
  //
  // Paginated in batches of 1000 -- a plain unpaginated .select() here hits
  // the same silent PostgREST row cap as the old inventory count stat, and
  // for a property with more real inventory than that (confirmed: 1048),
  // any ingredient name that happened to fall past row 1000 would silently
  // fail to link to its real inventory row.
  const inventoryItems: { id: string; name: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name')
      .eq('property_id', propertyId)
      .range(offset, offset + 999);
    inventoryItems.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const inventoryIdByName = new Map(inventoryItems.map((i) => [i.name.trim().toLowerCase(), i.id]));

  // A staple like "Chicken Stock" or "Salt" shows up in most recipes in a
  // week — generateShoppingList() in MealPlanView.tsx passes every recipe's
  // ingredients in as one batch, so the same name arrives here once per
  // recipe that calls for it. Group by name first so each unique ingredient
  // becomes exactly one shopping_list_items row with every contributing
  // recipe recorded as its own shopping_list_item_sources row (that's what
  // powers the "By Recipe" attribution), instead of one row per recipe.
  const groups = new Map<string, IngredientToAdd[]>();
  for (const ing of ingredients) {
    const key = ing.name.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.push(ing);
    else groups.set(key, [ing]);
  }

  // Also don't duplicate against what's already sitting on the list —
  // same name pattern the pre-existing handle_low_stock() trigger uses
  // (scoped to status='pending' so a name that was already bought and
  // is sitting there as 'purchased' still gets a fresh row for the new need).
  const { data: existingPending } = await supabase
    .from('shopping_list_items')
    .select('id, name')
    .eq('shopping_list_id', list!.id)
    .eq('status', 'pending');
  const existingIdByName = new Map((existingPending ?? []).map((i) => [i.name.trim().toLowerCase(), i.id]));

  const keysToInsert = [...groups.keys()].filter((key) => !existingIdByName.has(key));
  const itemIdByKey = new Map(existingIdByName);

  if (keysToInsert.length > 0) {
    const rows = keysToInsert.map((key) => {
      const ing = groups.get(key)![0];
      return {
        shopping_list_id: list!.id,
        // Quantity/unit are recorded per-source below in
        // shopping_list_item_sources already — baking them into the display
        // name too broke de-duplication (two entries of "Milk" at different
        // quantities never matched as the same item) for no benefit.
        name: ing.name,
        category: ing.category,
        qty_needed: 1,
        status: 'pending' as const,
        inventory_item_id: inventoryIdByName.get(key) ?? null,
      };
    });

    const { data: insertedItems, error: insertError } = await supabase
      .from('shopping_list_items')
      .insert(rows)
      .select('id');

    if (insertError || !insertedItems) {
      return { ok: false, error: 'Failed to add ingredients.' };
    }

    insertedItems.forEach((item, i) => itemIdByKey.set(keysToInsert[i], item.id));
  }

  const sourceRows = [...groups.entries()].flatMap(([key, group]) => {
    const itemId = itemIdByKey.get(key);
    if (!itemId) return [];
    return group
      .filter((ing) => ing.recipe_id)
      .map((ing) => ({
        shopping_list_item_id: itemId,
        recipe_id: ing.recipe_id,
        quantity: ing.quantity,
        unit: ing.unit,
      }));
  });

  if (sourceRows.length > 0) {
    await supabase.from('shopping_list_item_sources').insert(sourceRows);
  }

  return { ok: true, count: groups.size };
}
