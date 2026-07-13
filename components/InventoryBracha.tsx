// components/InventoryBracha.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import BrachaCategorySelect, { type BrachaCategoryRow } from '@/components/BrachaCategorySelect';

// Same derivation as app/recipes/actions.ts's deriveBrachaAchrona — kept in
// sync manually since one lives client-side (inventory writes go through
// resilientUpdate, not a server action) and the other server-side.
const SEVEN_SPECIES_TREE_FRUIT = /\b(grapes?|figs?|pomegranates?|olives?|dates?)\b/i;

function deriveBrachaAchrona(category: string | null, itemName: string): string | null {
  if (!category) return null;
  if (category === 'bread') return 'Birkat Hamazon';
  if (category === 'grain_mezonos') return 'Al Hamichyah';
  if (category === 'wine_grape_juice') return 'Al Hagefen';
  if (category === 'tree_fruit') {
    return SEVEN_SPECIES_TREE_FRUIT.test(itemName) ? "Al Ha'eitz" : 'Borei Nefashos';
  }
  if (['ground_produce', 'meat_fish_dairy_eggs', 'beverages_other'].includes(category)) {
    return 'Borei Nefashos';
  }
  return null;
}

export default function InventoryBracha({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [categories, setCategories] = useState<BrachaCategoryRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [achrona, setAchrona] = useState<string | null>(null);
  const [achronaNote, setAchronaNote] = useState<string | null>(null);
  const [needsSourcing, setNeedsSourcing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const supabase = createClient();

  // The parent's list-select and edit-form state don't carry bracha fields
  // (they're never shown in the grid) -- fetched here on mount instead of
  // threading them through InventoryClient's already-heavy queries.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: cats }, { data: item }] = await Promise.all([
        supabase
          .from('bracha_categories')
          .select('category, bracha_rishona, bracha_achrona, note')
          .order('category'),
        supabase
          .from('inventory_items')
          .select('bracha_category, bracha_achrona, bracha_achrona_note, bracha_needs_sourcing')
          .eq('id', itemId)
          .single(),
      ]);
      if (cancelled) return;
      setCategories(cats ?? []);
      setSelected(item?.bracha_category ?? null);
      setSaved(item?.bracha_category ?? null);
      setAchrona(item?.bracha_achrona ?? null);
      setAchronaNote(item?.bracha_achrona_note ?? null);
      setNeedsSourcing(!!item?.bracha_needs_sourcing);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const isDirty = selected !== saved;
  const selectedRow = categories.find((c) => c.category === selected);

  function handleSave() {
    startTransition(async () => {
      const newAchrona = selected ? deriveBrachaAchrona(selected, itemName) : null;
      const newNeedsSourcing = !!selected && newAchrona === null;

      const result = await resilientUpdate(
        supabase,
        'inventory_items',
        { id: itemId },
        {
          bracha_category: selected,
          bracha_achrona: newAchrona,
          bracha_needs_sourcing: newNeedsSourcing,
        }
      );

      if (result.ok) {
        setSaved(selected);
        setAchrona(newAchrona);
        setAchronaNote(null); // mechanical path never sets a note, matches recipes
        setNeedsSourcing(newNeedsSourcing);
        showToast(result.queued ? 'Saved — will sync when back online.' : 'Bracha saved.', {
          variant: 'success',
        });
      } else {
        showToast(result.error ?? 'Failed to save.', { variant: 'error' });
      }
    });
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
      <h3 className="font-display text-base text-charcoal mb-1">Bracha</h3>
      <p className="text-xs text-charcoal/50 mb-2">
        Which bracha applies — a manual judgment call, never auto-assigned.
      </p>

      <BrachaCategorySelect
        categories={categories}
        value={selected}
        onChange={setSelected}
        disabled={isPending}
        notSetLabel="Not set"
      />

      {selectedRow && (
        <div className="mt-2 text-xs text-charcoal/60 bg-cream px-3 py-2 rounded-lg space-y-0.5">
          <div>
            <span className="font-medium text-charcoal">Before:</span> {selectedRow.bracha_rishona}
          </div>
          <div>
            <span className="font-medium text-charcoal">After:</span> {selectedRow.bracha_achrona}
          </div>
          {selectedRow.note && <div className="italic pt-1">{selectedRow.note}</div>}
        </div>
      )}

      {/* needsSourcing can be true with no category at all -- e.g. peanut
          butter/cranberries (049_flag_peanut_butter_cranberry_needs_sourcing.sql),
          where the dispute is at the rishona level, so no category resolves
          it. That banner has to show regardless of what's selected/saved. */}
      {needsSourcing ? (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg bg-rust/10 text-rust font-medium">
          ⚠️ Consult your rav — sources needed
        </div>
      ) : (
        selected &&
        selected === saved &&
        achrona && (
          <div className="mt-2 text-xs px-3 py-2 rounded-lg bg-sage/10 text-charcoal">
            <span className="font-medium">Bracha achrona (after):</span> {achrona}
            {achronaNote && <div className="italic text-charcoal/60 pt-1">{achronaNote}</div>}
          </div>
        )
      )}

      <div className="flex justify-end gap-2 mt-2">
        {isDirty && !isPending && (
          <button
            onClick={() => setSelected(saved)}
            className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5"
          >
            Revert
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
