// components/AllergenVerificationClient.tsx
// Universal sibling of HechsherVerificationClient (observance gating
// amendment, 31 Jul 2026): every property gets this tool, always on --
// it is NOT the non-Jewish replacement for Hechsher Verification, which
// shows in addition to it on Jewish-observant properties.
//
// Same backlog shape as its sibling: every food-category inventory item
// whose allergens column IS NULL specifically -- an empty array is a real
// reviewed decision ("checked, none apply"), not an unreviewed gap, same
// convention the hechsher column already established with its "Not
// required" strings.
//
// Tag colors are the allergenTag token set (Concept B palette,
// tailwind.config.ts) -- rust/dairy/sage stay reserved for Meat/Dairy/
// Parve only, per the amendment.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { isFoodCategory } from '@/lib/foodCategories';

type Item = { id: string; name: string; category: string | null };

// FDA big-9 -- the same vocabulary the column comment documents
// (migration 168), so what the tool writes and what the schema promises
// can't drift apart.
const ALLERGENS = ['Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts', 'Wheat', 'Soy', 'Sesame'];

export default function AllergenVerificationClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, category')
      .eq('property_id', propertyId)
      .is('allergens', null)
      .order('name');
    setItems((data ?? []).filter((i) => isFoodCategory(i.category)));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAllergen(itemId: string, allergen: string) {
    setDrafts((prev) => {
      const next = new Set(prev[itemId] ?? []);
      if (next.has(allergen)) next.delete(allergen);
      else next.add(allergen);
      return { ...prev, [itemId]: next };
    });
  }

  async function save(item: Item, allergens: string[]) {
    setSavingId(item.id);
    const result = await resilientUpdate(supabase, 'inventory_items', { id: item.id }, { allergens });
    setSavingId(null);
    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    showToast(
      allergens.length === 0
        ? `${item.name} confirmed — no allergens.`
        : `${item.name} confirmed: ${allergens.join(', ')}.`,
      { variant: 'success' }
    );
  }

  if (!canManage(role)) {
    return <p className="max-w-md mx-auto p-4 text-sm text-dusk">Only an owner or manager can use this tool.</p>;
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Allergen Verification</h1>
      <p className="text-sm text-dusk mb-5">
        {items.length} item{items.length === 1 ? '' : 's'} with no reviewed allergen list yet. Tap what applies,
        then confirm — or confirm "none apply" outright.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-white rounded-2xl shadow-sm shadow-black/5">
          Nothing left to verify.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const draft = drafts[item.id] ?? new Set<string>();
            const busy = savingId === item.id;
            return (
              <li key={item.id} className="bg-white rounded-2xl shadow-sm shadow-black/5 p-4 space-y-2">
                <div>
                  <p className="font-medium text-sm text-denim">{item.name}</p>
                  {item.category && <p className="text-xs text-dusk">{item.category}</p>}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {ALLERGENS.map((a) => {
                    const on = draft.has(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAllergen(item.id, a)}
                        aria-pressed={on}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          on
                            ? 'bg-allergenTag-bg text-allergenTag border-allergenTag-border'
                            : 'bg-white text-dusk border-cardBorder hover:border-allergenTag-border/60'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => save(item, [...draft].sort())}
                    disabled={busy || draft.size === 0}
                    className="text-xs font-medium text-white bg-denim px-3 py-1.5 rounded-full disabled:opacity-40 shrink-0"
                  >
                    {busy ? '…' : `Confirm${draft.size > 0 ? ` (${draft.size})` : ''}`}
                  </button>
                  <button
                    onClick={() => save(item, [])}
                    disabled={busy || draft.size > 0}
                    className="text-xs text-dusk disabled:opacity-40"
                  >
                    Confirm — none apply
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
