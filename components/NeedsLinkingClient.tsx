// components/NeedsLinkingClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type UnlinkedGroup = {
  name: string;
  count: number;
  recipeIds: string[];
};

type InventoryOption = { id: string; name: string };

// Working queue for the "still needs a real link" backlog — one unlinked
// ingredient NAME at a time (grouped, since the same ingredient usually
// appears unlinked across several recipes), not one row at a time. Linking
// updates every recipe_ingredients row with that exact name at once.
export default function NeedsLinkingClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const showToast = useToast();

  const [groups, setGroups] = useState<UnlinkedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // recipe_ingredients has no property_id of its own — scope through
    // this property's recipe ids first.
    const { data: recipeRows } = await supabase.from('recipes').select('id').eq('property_id', propertyId);
    const recipeIds = (recipeRows ?? []).map((r) => r.id);

    if (recipeIds.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('recipe_ingredients')
      .select('name, recipe_id, is_food')
      .in('recipe_id', recipeIds)
      .is('inventory_item_id', null);

    const byName = new Map<string, UnlinkedGroup>();
    for (const row of data ?? []) {
      if (row.is_food === false) continue; // section headers etc. — not this queue's job
      const key = row.name.trim();
      if (!key) continue;
      const existing = byName.get(key);
      if (existing) {
        existing.count += 1;
        existing.recipeIds.push(row.recipe_id);
      } else {
        byName.set(key, { name: key, count: 1, recipeIds: [row.recipe_id] });
      }
    }

    setGroups([...byName.values()].sort((a, b) => b.count - a.count));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setInventoryOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(20);
      setInventoryOptions(data ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [search, propertyId, supabase]);

  async function linkTo(group: UnlinkedGroup, inventoryItemId: string) {
    setWorking(true);
    const result = await resilientUpdate(
      supabase,
      'recipe_ingredients',
      { name: group.name },
      { inventory_item_id: inventoryItemId }
    );
    setWorking(false);

    if (!result.ok) {
      showToast('Failed to link.', { variant: 'error' });
      return;
    }
    showToast(`Linked "${group.name}" (${group.count} recipe${group.count === 1 ? '' : 's'}).`, {
      variant: 'success',
    });
    setActiveName(null);
    setSearch('');
    setGroups((prev) => prev.filter((g) => g.name !== group.name));
  }

  async function markNotFood(group: UnlinkedGroup) {
    setWorking(true);
    const result = await resilientUpdate(supabase, 'recipe_ingredients', { name: group.name }, { is_food: false });
    setWorking(false);

    if (!result.ok) {
      showToast('Failed to update.', { variant: 'error' });
      return;
    }
    showToast(`Marked "${group.name}" as not a purchasable ingredient.`, { variant: 'success' });
    setActiveName(null);
    setGroups((prev) => prev.filter((g) => g.name !== group.name));
  }

  if (loading) return <SkeletonList />;

  const active = groups.find((g) => g.name === activeName) ?? null;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Needs Linking</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        {groups.length} ingredient{groups.length === 1 ? '' : 's'} still need a real inventory link.
      </p>

      {groups.length === 0 && (
        <p className="text-sm text-sage text-center py-8">Everything's linked. 🎉</p>
      )}

      {active ? (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-charcoal">{active.name}</h2>
            <button onClick={() => setActiveName(null)} className="text-sm text-charcoal/40 hover:text-charcoal">
              Back
            </button>
          </div>
          <p className="text-xs text-charcoal/50 mb-3">
            Appears unlinked in {active.count} recipe{active.count === 1 ? '' : 's'}. Linking updates all of them.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory items…"
            autoFocus
            className="w-full border border-gold-light/60 rounded-full px-4 py-2 text-sm mb-2"
          />
          {inventoryOptions.length > 0 && (
            <div className="border border-gold-light/40 rounded-xl divide-y divide-gold-light/20 mb-4 max-h-56 overflow-y-auto">
              {inventoryOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => linkTo(active, opt.id)}
                  disabled={working}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10 disabled:opacity-40"
                >
                  {opt.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => markNotFood(active)}
            disabled={working}
            className="w-full text-sm text-charcoal/50 hover:text-charcoal underline disabled:opacity-40"
          >
            Not actually a purchasable ingredient (mark not-food)
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.name}>
              <button
                onClick={() => {
                  setActiveName(group.name);
                  setSearch(group.name);
                }}
                className="w-full flex items-center justify-between bg-white rounded-xl shadow-sm shadow-charcoal/5 px-4 py-3 hover:bg-gold-light/10 transition-colors text-left"
              >
                <span className="text-sm font-medium text-charcoal">{group.name}</span>
                <span className="text-xs text-charcoal/40 shrink-0">
                  {group.count} recipe{group.count === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
