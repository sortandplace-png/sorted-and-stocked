// lib/task-supplies.ts
// task_supplies is the "products with links" mechanism -- it already joined
// task_id -> inventory_item_id (-> reorder_link) with bilingual notes and a
// nullable supplier_id, but had zero rows and, until this file existed,
// zero code referencing it anywhere in the app. Nothing new is introduced
// here: this is a read/write layer over the table as it already stands.
//
// The reorder link deliberately comes off the INVENTORY ITEM, not off
// task_supplies -- the table has no link column of its own, and the item is
// where every other surface in this app already reads a reorder link from
// (OrderLink's three-tier reorder_sources -> reorder_link -> Amazon-search
// fallback). One item can be the supply for several tasks and its link
// should not have to be re-entered per task.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReorderSource } from '@/lib/reorder-sources';

export type SupplyItem = {
  id: string;
  name: string;
  name_es: string | null;
  photo_url: string | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
};

export type TaskSupply = {
  id: string;
  task_id: string;
  note_en: string | null;
  note_es: string | null;
  item: SupplyItem | null;
};

// Same reorder_sources embed string every other read site uses (see
// lib/reorder-sources.ts) so OrderLink behaves identically here.
const SELECT =
  'id, task_id, note_en, note_es, inventory_items(id, name, name_es, photo_url, reorder_link, reorder_sources(id, retailer_name, url, is_preferred))';

type RawRow = {
  id: string;
  task_id: string;
  note_en: string | null;
  note_es: string | null;
  inventory_items: SupplyItem | null;
};

function normalize(rows: RawRow[] | null): TaskSupply[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    task_id: r.task_id,
    note_en: r.note_en,
    note_es: r.note_es,
    item: r.inventory_items ?? null,
  }));
}

/** Supplies for a set of tasks, grouped by task_id. Empty map on no ids --
 *  an `.in()` with an empty array is a query worth not sending. */
export async function fetchSuppliesByTask(
  supabase: SupabaseClient,
  taskIds: string[]
): Promise<Map<string, TaskSupply[]>> {
  const map = new Map<string, TaskSupply[]>();
  if (taskIds.length === 0) return map;

  const { data } = await supabase.from('task_supplies').select(SELECT).in('task_id', taskIds);

  for (const supply of normalize(data as RawRow[] | null)) {
    const list = map.get(supply.task_id);
    if (list) list.push(supply);
    else map.set(supply.task_id, [supply]);
  }
  return map;
}

/** Supplies shown against a PROCEDURE, scoped to one property.
 *
 *  sop_library is global and has no property_id -- per the SS-382 model,
 *  property specificity lives on the task, not the procedure. So a SOP's
 *  supplies are really "the supplies of THIS property's tasks that use this
 *  SOP": one house may need gloves for the Tineco procedure and another may
 *  not, and neither should see the other's list. Without the property
 *  filter this would leak one property's supply list onto every other
 *  property's copy of the same global procedure. */
export async function fetchSuppliesForSop(
  supabase: SupabaseClient,
  sopId: string,
  propertyId: string
): Promise<TaskSupply[]> {
  const { data: tasks } = await supabase
    .from('master_tasks')
    .select('id, master_task_sops!inner(sop_id)')
    .eq('property_id', propertyId)
    .eq('master_task_sops.sop_id', sopId);

  const taskIds = (tasks ?? []).map((t) => (t as { id: string }).id);
  if (taskIds.length === 0) return [];

  const { data } = await supabase.from('task_supplies').select(SELECT).in('task_id', taskIds);
  return normalize(data as RawRow[] | null);
}

/** Display name for a supply's item in the reader's locale, falling back to
 *  English when a Spanish name was never filled in (name_es is nullable on
 *  inventory_items, unlike the note fields this app requires in both). */
export function supplyItemName(item: SupplyItem | null, locale: string): string {
  if (!item) return '';
  return (locale === 'es' ? item.name_es || item.name : item.name) ?? '';
}

export function supplyNote(supply: TaskSupply, locale: string): string | null {
  return (locale === 'es' ? supply.note_es || supply.note_en : supply.note_en) ?? null;
}
