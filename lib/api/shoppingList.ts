// lib/api/shoppingList.ts
// API layer for Enhanced Shopping List — conditional render data layer
import { createClient } from '@/lib/supabase/client';
import type { ReorderSource } from '@/lib/reorder-sources';

export interface EnhancedShoppingItem {
  item_id: string;
  name: string;
  name_es: string | null;
  category: string;
  qty_needed: number;
  unit_estimate: string | null;
  status: 'pending' | 'purchased';
  // Rich inventory fields (null if unmapped ingredient)
  inventory_item_id: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
  current_stock: number | null;
  location_name: string | null;
  supplier: string | null;
  kosher_type: string | null;
  // UI flags for conditional rendering
  is_rich_item: boolean;
  is_staple_origin: boolean;
  // Pesach Mode: null for items with no linked inventory row (nothing to
  // flag against) or before the Pesach status column existed on old cached
  // callers -- the RPC itself never returns null for a real linked item.
  pesach_status: 'kosher_for_pesach' | 'not_kosher_for_pesach' | 'needs_review' | null;
}

/**
 * Fetch enhanced shopping list with conditional rich/plain rendering
 * Returns 483 rich items (inventory linked) + 800 plain text (unmapped ingredients)
 * UI checks is_rich_item to decide which component to render
 */
export async function fetchEnhancedShoppingList(
  shoppingListId: string
): Promise<EnhancedShoppingItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_shopping_list_with_inventory', {
    p_shopping_list_id: shoppingListId,
  });

  if (error) {
    console.error('Error fetching enhanced shopping list:', error.message);
    throw new Error(`Failed to load shopping list: ${error.message}`);
  }

  return (data || []) as EnhancedShoppingItem[];
}

/**
 * Update shopping list item status (pending → purchased or vice versa)
 * Optimistic updates handled in component; this persists to DB
 */
export async function updateShoppingItemStatus(
  itemId: string,
  status: 'pending' | 'purchased'
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('shopping_list_items')
    .update({ status })
    .eq('id', itemId);

  if (error) {
    console.error('Error updating item status:', error.message);
    throw new Error(`Failed to update item: ${error.message}`);
  }
}

export interface ShoppingItemSource {
  shopping_list_item_id: string;
  recipe_id: string;
  recipe_name: string;
  recipe_name_es: string | null;
  recipe_photo_url: string | null;
  quantity: number | null;
  unit: string | null;
  // Pesach Mode: whether the source recipe is tagged Pesach -- powers the
  // inline "not cleared for Pesach" flag on shopping list items.
  is_pesach: boolean;
}

/**
 * Fetch which recipe(s) each shopping list item came from — powers the
 * "By Recipe" grouping and the "used in N recipes" pills. Items added by
 * hand (addCustomItem) or from Staples have no rows here, which is
 * expected — they just render with no attribution.
 *
 * Filters by shopping_list_id through a join rather than passing every
 * item's UUID in an .in() list — a list with hundreds of items (this app
 * regularly has 300+) turns that into a multi-kilobyte query string that
 * can fail silently, which is exactly what happened during testing.
 */
export async function fetchItemSources(shoppingListId: string): Promise<ShoppingItemSource[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('shopping_list_item_sources')
    .select('shopping_list_item_id, recipe_id, quantity, unit, recipes(name, name_es, is_pesach, photo_url), shopping_list_items!inner(shopping_list_id)')
    .eq('shopping_list_items.shopping_list_id', shoppingListId);

  if (error) {
    console.error('Error fetching item sources:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    shopping_list_item_id: row.shopping_list_item_id,
    recipe_id: row.recipe_id,
    recipe_name: row.recipes?.name ?? 'Unknown recipe',
    recipe_name_es: row.recipes?.name_es ?? null,
    recipe_photo_url: row.recipes?.photo_url ?? null,
    quantity: row.quantity,
    unit: row.unit,
    is_pesach: !!row.recipes?.is_pesach,
  }));
}

/**
 * Delete/remove item from shopping list
 */
export async function removeShoppingItem(itemId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting shopping item:', error.message);
    throw new Error(`Failed to remove item: ${error.message}`);
  }
}
