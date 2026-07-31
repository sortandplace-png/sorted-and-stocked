// lib/low-stock.ts
// THE client-side definition of "low stock" -- the TypeScript mirror of
// public.is_inventory_item_low() (migration 158), which every database
// surface (get_low_stock_items, get_low_stock_item_ids, the three
// v_low_stock_* views) now calls. Two definitions of "low" caused SS-247;
// by 31 Jul there were six. Now there is one per layer: the SQL function,
// and this. If the definition ever changes, change both in the same
// commit.
//
// The definition (SS-157): an item is low when it has a minimum, a person
// has actually counted it at least once, it participates in auto-restock,
// and the count is at or below the minimum. Never-counted is deliberately
// NOT low -- it is its own state ("go count it"), with its own pill.
//
// Null semantics deliberately match SQL: a null current_qty makes the
// comparison unknown, i.e. not low.
export type LowStockFields = {
  current_qty: number | null;
  min_qty: number | null;
  auto_restock_eligible: boolean;
  last_counted_at: string | null;
};

export function isInventoryItemLow(item: LowStockFields): boolean {
  if (item.min_qty === null) return false;
  if (item.last_counted_at === null) return false;
  if (!item.auto_restock_eligible) return false;
  return item.current_qty !== null && item.current_qty <= item.min_qty;
}
