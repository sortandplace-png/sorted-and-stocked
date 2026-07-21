// components/UsedInRecipes.tsx
// "Which recipes use this item" for the Inventory Item Detail view.
// SS-125's original ask pointed at v_recipe_used_in, but that view tracks
// recipe-used-as-a-component-within-another-recipe (component_recipe_id /
// used_in_recipe_id) and has no inventory_item_id column at all -- it
// can't answer this question. recipe_ingredients.inventory_item_id is the
// real, already-established link (confirmed live and 98% populated,
// used throughout the app tonight), so this queries that directly.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import PhotoOrFallback from '@/components/PhotoOrFallback';

type UsedInRecipe = { id: string; name: string; name_es: string | null; photo_url: string | null };

export default function UsedInRecipes({ itemId, propertyId }: { itemId: string; propertyId: string }) {
  const [recipes, setRecipes] = useState<UsedInRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('recipes(id, name, name_es, photo_url)')
        .eq('inventory_item_id', itemId);
      if (cancelled) return;
      // One ingredient row per match, but the same recipe can reference
      // this item more than once (e.g. once in a Marinade section, again
      // in a Sauce section) -- dedupe to one entry per recipe.
      const byId = new Map<string, UsedInRecipe>();
      for (const row of data ?? []) {
        const r = row.recipes as unknown as UsedInRecipe | null;
        if (r && !byId.has(r.id)) byId.set(r.id, r);
      }
      setRecipes([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (loading || recipes.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-brass mb-2">
        {recipes.length > 1 ? `Used in recipes (${recipes.length})` : 'Used in recipes'}
      </h3>
      <ul className="space-y-1.5">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/properties/${propertyId}/recipes/${r.id}`}
              className="flex items-center gap-2.5 bg-linen/40 rounded-xl px-3 py-2 hover:bg-mist transition-colors"
            >
              <PhotoOrFallback src={r.photo_url} alt="" sizeClass="w-9 h-9" rounded="rounded-lg" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-denim truncate">{r.name}</span>
                {r.name_es && <span className="block text-xs text-dusk truncate">{r.name_es}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
