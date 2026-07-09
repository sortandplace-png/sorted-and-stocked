// components/NeedsLinkingClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
type SimilarMatch = { id: string; name: string; location_name: string | null; similarity: number };

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

  const [waterExpanded, setWaterExpanded] = useState(false);
  const [waterSuggestion, setWaterSuggestion] = useState<SimilarMatch | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  // 'water' links every water-variant name at once; 'selected' links every
  // checked "other" name at once — both reuse the same search+pick UI below.
  const [bulkLinkTarget, setBulkLinkTarget] = useState<'water' | 'selected' | null>(null);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkOptions, setBulkOptions] = useState<InventoryOption[]>([]);

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

  const waterGroups = useMemo(() => groups.filter((g) => /water/i.test(g.name)), [groups]);
  const otherGroups = useMemo(() => groups.filter((g) => !/water/i.test(g.name)), [groups]);
  const waterTotalMentions = waterGroups.reduce((sum, g) => sum + g.count, 0);

  // One best-match suggestion for the water bucket as a whole (using the
  // literal word "water" as the query) — recomputed whenever the bucket's
  // membership changes, not on every render.
  useEffect(() => {
    if (waterGroups.length === 0) {
      setWaterSuggestion(null);
      return;
    }
    supabase
      .rpc('find_similar_inventory_items', { p_property_id: propertyId, p_name: 'water' })
      .then(({ data }: { data: SimilarMatch[] | null }) => setWaterSuggestion(data?.[0] ?? null));
  }, [waterGroups.length, propertyId, supabase]);

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

  useEffect(() => {
    if (!bulkLinkTarget) return;
    if (!bulkSearch.trim()) {
      setBulkOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .ilike('name', `%${bulkSearch.trim()}%`)
        .order('name')
        .limit(20);
      setBulkOptions(data ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [bulkSearch, bulkLinkTarget, propertyId, supabase]);

  async function linkNamesTo(names: string[], inventoryItemId: string) {
    setWorking(true);
    let failed = 0;
    for (const name of names) {
      const result = await resilientUpdate(supabase, 'recipe_ingredients', { name }, { inventory_item_id: inventoryItemId });
      if (!result.ok) failed++;
    }
    setWorking(false);

    if (failed > 0) {
      showToast(`Linked ${names.length - failed} of ${names.length} — ${failed} failed.`, { variant: 'error' });
    } else {
      showToast(`Linked ${names.length} ingredient${names.length === 1 ? '' : 's'}.`, { variant: 'success' });
    }
    setGroups((prev) => prev.filter((g) => !names.includes(g.name)));
    setSelectedNames(new Set());
    setBulkLinkTarget(null);
    setBulkSearch('');
  }

  async function markNamesNotFood(names: string[]) {
    setWorking(true);
    let failed = 0;
    for (const name of names) {
      const result = await resilientUpdate(supabase, 'recipe_ingredients', { name }, { is_food: false });
      if (!result.ok) failed++;
    }
    setWorking(false);

    if (failed > 0) {
      showToast(`Ignored ${names.length - failed} of ${names.length} — ${failed} failed.`, { variant: 'error' });
    } else {
      showToast(`Marked ${names.length} ingredient${names.length === 1 ? '' : 's'} as not purchasable.`, {
        variant: 'success',
      });
    }
    setGroups((prev) => prev.filter((g) => !names.includes(g.name)));
    setSelectedNames(new Set());
  }

  function toggleSelected(name: string) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
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
                  onClick={() => linkNamesTo([active.name], opt.id)}
                  disabled={working}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10 disabled:opacity-40"
                >
                  {opt.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => markNamesNotFood([active.name])}
            disabled={working}
            className="w-full text-sm text-charcoal/50 hover:text-charcoal underline disabled:opacity-40"
          >
            Not actually a purchasable ingredient (mark not-food)
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {waterGroups.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 overflow-hidden">
              <button
                onClick={() => setWaterExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span>
                  <span className="block font-display text-lg text-charcoal">💧 Water group</span>
                  <span className="block text-xs text-charcoal/50">
                    {waterGroups.length} variant{waterGroups.length === 1 ? '' : 's'} · {waterTotalMentions} appearance
                    {waterTotalMentions === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-charcoal/40 text-sm">{waterExpanded ? '▲' : '▼'}</span>
              </button>

              {waterExpanded && (
                <ul className="px-4 pb-2 space-y-1">
                  {waterGroups.map((g) => (
                    <li key={g.name} className="text-xs text-charcoal/60 flex items-center justify-between">
                      <span className="truncate">{g.name}</span>
                      <span className="text-charcoal/40 shrink-0 ml-2">
                        {g.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="px-4 pb-4 pt-1 border-t border-gold-light/30">
                {waterSuggestion && (
                  <p className="text-xs text-charcoal/50 mb-2">
                    Suggested match: <span className="font-medium text-charcoal">{waterSuggestion.name}</span>{' '}
                    <span className="text-gold-dark">({Math.round(waterSuggestion.similarity * 100)}% match)</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {waterSuggestion && (
                    <button
                      onClick={() => linkNamesTo(waterGroups.map((g) => g.name), waterSuggestion.id)}
                      disabled={working}
                      className="text-xs font-medium bg-gold-dark text-white px-3 py-1.5 rounded-full disabled:opacity-40"
                    >
                      Link all to {waterSuggestion.name}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setBulkLinkTarget('water');
                      setBulkSearch('water');
                    }}
                    disabled={working}
                    className="text-xs font-medium border border-gold-light/60 text-charcoal px-3 py-1.5 rounded-full disabled:opacity-40"
                  >
                    Link All to Inventory Item…
                  </button>
                  <button
                    onClick={() => markNamesNotFood(waterGroups.map((g) => g.name))}
                    disabled={working}
                    className="text-xs font-medium border border-gold-light/60 text-charcoal px-3 py-1.5 rounded-full disabled:opacity-40"
                  >
                    Ignore All Water
                  </button>
                </div>

                {bulkLinkTarget === 'water' && (
                  <div className="mt-3">
                    <input
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      placeholder="Search inventory items…"
                      autoFocus
                      className="w-full border border-gold-light/60 rounded-full px-4 py-2 text-sm mb-2"
                    />
                    {bulkOptions.length > 0 && (
                      <div className="border border-gold-light/40 rounded-xl divide-y divide-gold-light/20 max-h-40 overflow-y-auto">
                        {bulkOptions.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => linkNamesTo(waterGroups.map((g) => g.name), opt.id)}
                            disabled={working}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10 disabled:opacity-40"
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {otherGroups.length > 0 && (
            <div>
              {waterGroups.length > 0 && (
                <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">Other ingredients</h2>
              )}
              <ul className="space-y-2">
                {otherGroups.map((group) => (
                  <li
                    key={group.name}
                    className="flex items-center gap-2 bg-white rounded-xl shadow-sm shadow-charcoal/5 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedNames.has(group.name)}
                      onChange={() => toggleSelected(group.name)}
                      className="h-4 w-4 accent-gold-dark rounded shrink-0"
                      aria-label={`Select ${group.name}`}
                    />
                    <button
                      onClick={() => {
                        setActiveName(group.name);
                        setSearch(group.name);
                      }}
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-medium text-charcoal">{group.name}</span>
                      <span className="text-xs text-charcoal/40 shrink-0 ml-2">
                        {group.count} recipe{group.count === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedNames.size > 0 && (
            <div className="sticky bottom-4 bg-white rounded-2xl shadow-md shadow-charcoal/10 border border-gold-light/40 p-3">
              <p className="text-xs text-charcoal/50 mb-2">{selectedNames.size} selected</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setBulkLinkTarget('selected');
                    setBulkSearch('');
                  }}
                  disabled={working}
                  className="text-xs font-medium bg-gold-dark text-white px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  Link selected to…
                </button>
                <button
                  onClick={() => markNamesNotFood([...selectedNames])}
                  disabled={working}
                  className="text-xs font-medium border border-gold-light/60 text-charcoal px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  Ignore selected
                </button>
                <button
                  onClick={() => setSelectedNames(new Set())}
                  disabled={working}
                  className="text-xs text-charcoal/50 underline px-1 py-1.5"
                >
                  Clear
                </button>
              </div>

              {bulkLinkTarget === 'selected' && (
                <div className="mt-3">
                  <input
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder="Search inventory items…"
                    autoFocus
                    className="w-full border border-gold-light/60 rounded-full px-4 py-2 text-sm mb-2"
                  />
                  {bulkOptions.length > 0 && (
                    <div className="border border-gold-light/40 rounded-xl divide-y divide-gold-light/20 max-h-40 overflow-y-auto">
                      {bulkOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => linkNamesTo([...selectedNames], opt.id)}
                          disabled={working}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gold-light/10 disabled:opacity-40"
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
