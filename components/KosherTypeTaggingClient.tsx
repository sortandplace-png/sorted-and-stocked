// components/KosherTypeTaggingClient.tsx
// Owner/manager bulk-tagging tool: the enforce_recipe_kosher_type trigger and
// is_recipe_eligible_for_date's warnings only have real data to catch a
// conflict when inventory_items.kosher_type is actually set -- one-by-one
// entry across hundreds of items was never realistic. Groups food-category
// items with no kosher_type by their existing category, so an owner/manager
// can select-all within a real category (e.g. all 54 Meat & Seafood items),
// apply Meat/Dairy/Parve in one action, then handle any real exceptions by
// unchecking them first -- never a silent auto-tag from the category name
// alone, someone always clicks Meat/Dairy/Parve explicitly.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { isFoodCategory } from '@/lib/foodCategories';

type Item = { id: string; name: string; category: string | null };
type KosherType = 'Meat' | 'Dairy' | 'Parve';
const KOSHER_TYPES: KosherType[] = ['Meat', 'Dairy', 'Parve'];

export default function KosherTypeTaggingClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyingCategory, setApplyingCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, category')
      .eq('property_id', propertyId)
      .is('kosher_type', null)
      .order('name');
    setItems((data ?? []).filter((i) => isFoodCategory(i.category)));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInGroup(groupItems: Item[]) {
    setSelected((prev) => new Set([...prev, ...groupItems.map((i) => i.id)]));
  }

  function clearGroup(groupItems: Item[]) {
    const groupIds = new Set(groupItems.map((i) => i.id));
    setSelected((prev) => new Set([...prev].filter((id) => !groupIds.has(id))));
  }

  async function applyToGroup(groupItems: Item[], kosherType: KosherType) {
    const ids = groupItems.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (ids.length === 0) return;
    setApplyingCategory(groupItems[0]?.category ?? '');
    const { error } = await supabase.from('inventory_items').update({ kosher_type: kosherType }).in('id', ids);
    setApplyingCategory(null);
    if (error) {
      showToast('Failed to tag — try again.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    showToast(`Tagged ${ids.length} item${ids.length === 1 ? '' : 's'} ${kosherType}.`, { variant: 'success' });
  }

  if (!canManage(role)) {
    return <p className="max-w-md mx-auto p-4 text-sm text-charcoal/50">Only an owner or manager can use this tool.</p>;
  }

  if (loading) return <SkeletonList />;

  const groups = Object.entries(
    items.reduce((acc: Record<string, Item[]>, item) => {
      const key = item.category ?? 'Uncategorized';
      (acc[key] ??= []).push(item);
      return acc;
    }, {})
  )
    .map(([category, groupItems]) => ({ category, groupItems }))
    .sort((a, b) => b.groupItems.length - a.groupItems.length);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Kosher Type Tagging</h1>
      <p className="text-sm text-charcoal/50 mb-5">
        {items.length} item{items.length === 1 ? '' : 's'} with no kosher type on file yet, grouped by category.
        Select all, uncheck any real exceptions, then tag the rest in one click.
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-charcoal/40 text-center py-8 bg-white rounded-2xl shadow-sm shadow-charcoal/5">
          Nothing left to tag.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ category, groupItems }) => {
            const groupSelectedCount = groupItems.filter((i) => selected.has(i.id)).length;
            const busy = applyingCategory === category;
            return (
              <div key={category} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-base text-charcoal">
                    {category} <span className="text-charcoal/40 font-normal text-sm">({groupItems.length})</span>
                  </h2>
                  <div className="flex gap-2 text-xs font-medium text-gold-dark">
                    <button onClick={() => selectAllInGroup(groupItems)}>Select all</button>
                    <button onClick={() => clearGroup(groupItems)}>Clear</button>
                  </div>
                </div>

                <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-center gap-2 py-1 text-sm text-charcoal cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="rounded border-gold-light/60 text-gold-dark"
                        />
                        {item.name}
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-charcoal/50">{groupSelectedCount} selected</span>
                  {KOSHER_TYPES.map((kt) => (
                    <button
                      key={kt}
                      onClick={() => applyToGroup(groupItems, kt)}
                      disabled={busy || groupSelectedCount === 0}
                      className="text-xs font-medium text-white bg-gold-dark px-3 py-1.5 rounded-full disabled:opacity-40"
                    >
                      {busy ? '…' : `Tag ${kt}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
