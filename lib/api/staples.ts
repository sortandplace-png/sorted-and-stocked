// lib/api/staples.ts
// API layer for Staples Dashboard — direct RPC integration
import { createClient } from '@/lib/supabase/client';

export interface StaplesWithInventory {
  staple_id: string;
  staple_name: string;
  staple_category: string;
  default_unit: string;
  inventory_item_id: string;
  current_qty: number;
  min_qty: number;
  location_id: string | null;
  photo_url: string | null;
  is_low: boolean;
  already_on_list: boolean;
  hechsher: string | null;
}

/**
 * Fetch all staples with current inventory details for a property
 * Powers the Household Staples tab with stock indicators and add-to-list state
 */
export async function fetchStaplesWithInventory(
  propertyId: string,
  shoppingListId: string
): Promise<StaplesWithInventory[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_staples_with_inventory', {
    p_property_id: propertyId,
    p_shopping_list_id: shoppingListId,
  });

  if (error) {
    console.error('Error fetching staples inventory:', error.message);
    throw new Error(`Failed to load staples: ${error.message}`);
  }

  return (data || []) as StaplesWithInventory[];
}

/**
 * Add a staple to the shopping list (idempotent)
 * Returns immediately if already on list, otherwise creates new item
 */
export async function addStapleToList(
  shoppingListId: string,
  stapleId: string
): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('add_staple_to_shopping_list', {
    p_shopping_list_id: shoppingListId,
    p_staple_id: stapleId,
  });

  if (error) {
    console.error('Error adding staple to list:', error.message);
    throw new Error(`Failed to add staple: ${error.message}`);
  }

  return (data as string | null) || null;
}
