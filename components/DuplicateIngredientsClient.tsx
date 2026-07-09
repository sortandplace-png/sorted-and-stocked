// components/DuplicateIngredientsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Variant = { name: string; count: number; inventory_item_id: string | null };
type Cluster = { key: string; variants: Variant[] };

// Lightweight normalization, not real fuzzy matching — lowercase, trim,
// collapse whitespace, strip a trailing "s". Catches the common real cases
// (casing, pluralization) without the false-positive risk of something
// heavier like Levenshtein distance (which would happily cluster
// "Cinnamon" with "Cardamom").
function normalize(name: string): string {
  const lower = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return lower.endsWith('s') && lower.length > 3 ? lower.slice(0, -1) : lower;
}

export default function DuplicateIngredientsClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const showToast = useToast();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: recipeRows } = await supabase.from('recipes').select('id').eq('property_id', propertyId);
    const recipeIds = (recipeRows ?? []).map((r) => r.id);

    if (recipeIds.length === 0) {
      setClusters([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('recipe_ingredients')
      .select('name, inventory_item_id')
      .in('recipe_id', recipeIds);

    const byKey = new Map<string, Map<string, Variant>>();
    for (const row of data ?? []) {
      const key = normalize(row.name);
      const variantsForKey = byKey.get(key) ?? new Map<string, Variant>();
      const existing = variantsForKey.get(row.name);
      if (existing) {
        existing.count += 1;
        existing.inventory_item_id = existing.inventory_item_id ?? row.inventory_item_id;
      } else {
        variantsForKey.set(row.name, { name: row.name, count: 1, inventory_item_id: row.inventory_item_id });
      }
      byKey.set(key, variantsForKey);
    }

    const found: Cluster[] = [];
    for (const [key, variantsMap] of byKey) {
      const variants = [...variantsMap.values()];
      if (variants.length > 1) {
        found.push({ key, variants: variants.sort((a, b) => b.count - a.count) });
      }
    }
    setClusters(found.sort((a, b) => b.variants.length - a.variants.length));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function merge(cluster: Cluster, canonical: Variant) {
    setMerging(cluster.key);
    const others = cluster.variants.filter((v) => v.name !== canonical.name);

    for (const other of others) {
      const result = await resilientUpdate(
        supabase,
        'recipe_ingredients',
        { name: other.name },
        {
          name: canonical.name,
          inventory_item_id: canonical.inventory_item_id ?? other.inventory_item_id,
        }
      );
      if (!result.ok) {
        showToast(`Failed to merge "${other.name}".`, { variant: 'error' });
        setMerging(null);
        return;
      }
    }

    setMerging(null);
    showToast(`Merged into "${canonical.name}".`, { variant: 'success' });
    setClusters((prev) => prev.filter((c) => c.key !== cluster.key));
  }

  if (loading) return <SkeletonList />;

  const q = search.trim().toLowerCase();
  const filteredClusters = q
    ? clusters.filter((c) => c.variants.some((v) => v.name.toLowerCase().includes(q)))
    : clusters;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Duplicate Ingredients</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Likely the same ingredient, spelled differently across recipes. Pick which spelling to keep.
      </p>

      {clusters.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredient…"
          className="w-full border border-gold-light/60 rounded-full px-4 py-2.5 bg-white mb-4 text-sm"
        />
      )}

      {clusters.length === 0 && <p className="text-sm text-sage text-center py-8">No likely duplicates found.</p>}
      {clusters.length > 0 && filteredClusters.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">No duplicates match your search.</p>
      )}

      <div className="space-y-3">
        {filteredClusters.map((cluster) => (
          <div key={cluster.key} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {cluster.variants.map((v) => (
                <span key={v.name} className="text-xs bg-gold-light/20 text-charcoal px-2.5 py-1 rounded-full">
                  {v.name} <span className="text-charcoal/40">×{v.count}</span>
                  {v.inventory_item_id && <span className="text-sage"> ✓ linked</span>}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {cluster.variants.map((v) => (
                <button
                  key={v.name}
                  onClick={() => merge(cluster, v)}
                  disabled={merging === cluster.key}
                  className="text-xs font-medium bg-charcoal text-cream px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  {merging === cluster.key ? 'Merging…' : `Keep "${v.name}"`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
