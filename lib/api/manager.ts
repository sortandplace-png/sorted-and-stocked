// lib/api/manager.ts
// API layer for the manager (Racquel/Blimie) cross-property platform --
// PHASE 1: these RPCs don't exist in the live database yet (see
// supabase/migrations/074_manager_platform_phase1.sql, not applied). This
// file is written and typechecked ahead of activation so the UI layer is
// ready the moment the migration lands; every call here will fail with a
// "function does not exist" error until then.
import { createClient } from '@/lib/supabase/client';

export interface ManagerCapturedInventoryItem {
  captured_id: string;
  property_id: string;
  property_name: string;
  name: string;
  category: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  kosher_type: string | null;
  supplier: string | null;
  source_deleted_at: string | null;
}

export interface ManagerCapturedRecipe {
  captured_id: string;
  property_id: string;
  property_name: string;
  name: string;
  course: string | null;
  kosher_type: string | null;
  photo_url: string | null;
  source_deleted_at: string | null;
}

export async function fetchManagerInventoryAggregate(
  propertyId: string | null,
  nameSearch: string | null
): Promise<ManagerCapturedInventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_manager_inventory_aggregate', {
    p_property_id: propertyId,
    p_name_search: nameSearch,
  });
  if (error) throw new Error(`Failed to load manager inventory aggregate: ${error.message}`);
  return (data || []) as ManagerCapturedInventoryItem[];
}

export async function fetchManagerRecipesAggregate(
  propertyId: string | null,
  nameSearch: string | null
): Promise<ManagerCapturedRecipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_manager_recipes_aggregate', {
    p_property_id: propertyId,
    p_name_search: nameSearch,
  });
  if (error) throw new Error(`Failed to load manager recipes aggregate: ${error.message}`);
  return (data || []) as ManagerCapturedRecipe[];
}

export async function approveInventoryItemToLibrary(capturedItemId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('approve_inventory_item_to_library', {
    p_captured_item_id: capturedItemId,
  });
  if (error) throw new Error(`Failed to approve item to library: ${error.message}`);
  return data as string;
}

export async function approveRecipeToLibrary(capturedRecipeId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('approve_recipe_to_library', {
    p_captured_recipe_id: capturedRecipeId,
  });
  if (error) throw new Error(`Failed to approve recipe to library: ${error.message}`);
  return data as string;
}

export interface LibraryInventoryItem {
  id: string;
  name: string;
  category: string | null;
  photo_url: string | null;
  active: boolean;
  approved_at: string;
}

export interface LibraryRecipe {
  id: string;
  name: string;
  course: string | null;
  photo_url: string | null;
  active: boolean;
  approved_at: string;
}

export async function fetchLibraryInventoryItems(): Promise<LibraryInventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shared_library_inventory_items')
    .select('id, name, category, photo_url, active, approved_at')
    .order('name');
  if (error) throw new Error(`Failed to load shared library inventory: ${error.message}`);
  return (data || []) as LibraryInventoryItem[];
}

export async function fetchLibraryRecipes(): Promise<LibraryRecipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shared_library_recipes')
    .select('id, name, course, photo_url, active, approved_at')
    .order('name');
  if (error) throw new Error(`Failed to load shared library recipes: ${error.message}`);
  return (data || []) as LibraryRecipe[];
}

export async function retireLibraryInventoryItem(libraryItemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('retire_library_inventory_item', { p_library_item_id: libraryItemId });
  if (error) throw new Error(`Failed to retire library item: ${error.message}`);
}

export async function retireLibraryRecipe(libraryRecipeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('retire_library_recipe', { p_library_recipe_id: libraryRecipeId });
  if (error) throw new Error(`Failed to retire library recipe: ${error.message}`);
}

export interface OnboardResult {
  inventory_items_copied: number;
  recipes_copied: number;
}

export async function onboardPropertyFromLibrary(propertyId: string): Promise<OnboardResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('onboard_property_from_library', { p_property_id: propertyId });
  if (error) throw new Error(`Failed to onboard property: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row as OnboardResult;
}
