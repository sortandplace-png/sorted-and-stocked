// lib/api/shoppingList.ts
// API layer for Enhanced Shopping List — conditional render data layer
import { createClient } from '@/lib/supabase/client';

export interface EnhancedShoppingItem {
  item_id: string;
  name: string;
  category: string;
  qty_needed: number;
  unit_estimate: string | null;
  status: 'pending' | 'purchased';
  // Rich inventory fields (null if unmapped ingredient)
  inventory_item_id: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  current_stock: number | null;
  location_name: string | null;
  supplier: string | null;
  // UI flags for conditional rendering
  is_rich_item: boolean;
  is_staple_origin: boolean;
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
