// lib/digest-data.ts
// Data for the SS-019 Digest Preview page (app/properties/[id]/tools/digest)
// -- view-only. The automated email/SMS dispatch this data could
// eventually feed stays on hold, deliberately not built here.
import { createClient } from '@/lib/supabase/server';
import { getPreferredSource, type ReorderSource } from '@/lib/reorder-sources';

export type LowStockByVendor = {
  vendor: string;
  items: {
    id: string;
    name: string;
    nameEs: string | null;
    currentQty: number;
    minQty: number;
    shortBy: number;
    photoUrl: string | null;
    reorderSources: ReorderSource[] | null;
    reorderLink: string | null;
  }[];
};

// Same get_low_stock_for_property() RPC the Dashboard's own Low Stock
// tile uses (lib/dashboard-widgets-data.ts) -- regrouped here by
// preferred vendor instead of a flat list, using the same
// getPreferredSource() precedence already used for the Shopping List's
// By Store grouping, not a second way of picking "the" vendor for an item.
export async function getLowStockByVendor(propertyId: string): Promise<LowStockByVendor[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_low_stock_for_property', { p_property_id: propertyId });
  const rows = data ?? [];
  const ids = rows.map((r: any) => r.item_id);

  const sourcesById = new Map<string, ReorderSource[]>();
  if (ids.length > 0) {
    const { data: extra } = await supabase
      .from('inventory_items')
      .select('id, reorder_sources(id, retailer_name, url, is_preferred)')
      .in('id', ids);
    for (const row of extra ?? []) {
      sourcesById.set(row.id, (row as any).reorder_sources ?? []);
    }
  }

  const byVendor = new Map<string, LowStockByVendor['items']>();
  for (const r of rows) {
    const sources = sourcesById.get(r.item_id) ?? null;
    const vendor = getPreferredSource(sources)?.retailer_name || 'Other';
    const list = byVendor.get(vendor) ?? [];
    list.push({
      id: r.item_id,
      name: r.name,
      nameEs: r.name_es,
      currentQty: r.current_qty,
      minQty: r.min_qty,
      shortBy: r.short_by,
      photoUrl: r.photo_url,
      reorderSources: sources,
      reorderLink: r.reorder_link,
    });
    byVendor.set(vendor, list);
  }

  return [...byVendor.entries()]
    .map(([vendor, items]) => ({ vendor, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

export type MealPlanGapItem = {
  inventoryItemId: string;
  name: string;
  nameEs: string | null;
  unit: string | null;
  needed: number;
  currentQty: number;
  shortBy: number;
  recipeNames: string[];
};

// 7-day window, matching the weekly-digest cadence this page previews.
// Sums quantity across every planned use of the same linked inventory
// item in that window before comparing to current stock -- checking each
// planned use in isolation would miss the real gap (two separate chicken
// dishes that week can each look "enough" on their own against today's
// stock, while neither on its own is the actual number that matters).
// Ingredients with no inventory_item_id link, or no quantity recorded,
// can't be checked against real stock and are skipped rather than guessed.
export async function getMealPlanGapAnalysis(propertyId: string, todayStr: string): Promise<MealPlanGapItem[]> {
  const supabase = await createClient();
  const weekAhead = new Date(`${todayStr}T00:00:00Z`);
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  const weekAheadStr = weekAhead.toISOString().slice(0, 10);

  const { data: entries } = await supabase
    .from('meal_plan_entries')
    .select('recipe_id')
    .eq('property_id', propertyId)
    .gte('plan_date', todayStr)
    .lt('plan_date', weekAheadStr)
    .not('recipe_id', 'is', null);
  const recipeIds = [...new Set((entries ?? []).map((e) => e.recipe_id as string))];
  if (recipeIds.length === 0) return [];

  const { data: ingredientRows } = await supabase
    .from('recipe_ingredients')
    .select('inventory_item_id, quantity, unit, name, recipe_id, recipes(name)')
    .in('recipe_id', recipeIds)
    .eq('is_food', true)
    .not('inventory_item_id', 'is', null)
    .not('quantity', 'is', null);

  const needByItem = new Map<string, { unit: string | null; needed: number; recipeNames: Set<string> }>();
  for (const row of ingredientRows ?? []) {
    const itemId = row.inventory_item_id as string;
    const recipeName = (row.recipes as unknown as { name: string } | null)?.name ?? (row.name as string);
    const entry = needByItem.get(itemId) ?? { unit: row.unit as string | null, needed: 0, recipeNames: new Set<string>() };
    entry.needed += row.quantity as number;
    entry.recipeNames.add(recipeName);
    needByItem.set(itemId, entry);
  }
  if (needByItem.size === 0) return [];

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, name_es, current_qty')
    .in('id', [...needByItem.keys()]);

  const gaps: MealPlanGapItem[] = [];
  for (const item of items ?? []) {
    const need = needByItem.get(item.id);
    if (!need) continue;
    const shortBy = need.needed - (item.current_qty ?? 0);
    if (shortBy > 0) {
      gaps.push({
        inventoryItemId: item.id,
        name: item.name,
        nameEs: item.name_es,
        unit: need.unit,
        needed: need.needed,
        currentQty: item.current_qty ?? 0,
        shortBy,
        recipeNames: [...need.recipeNames],
      });
    }
  }
  return gaps.sort((a, b) => b.shortBy - a.shortBy);
}
