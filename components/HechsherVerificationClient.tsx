// components/HechsherVerificationClient.tsx
// Owner/manager backlog: every food-category inventory item with no
// hechsher on file yet. Turns "search each item individually, hope for a
// clean result" into one click per item against the two authoritative
// databases (OU, OK) instead of general web search.
//
// Meat & Seafood items are a genuinely different case, not just a filter --
// hechsher for meat/poultry/fish depends on the specific butcher/supplier,
// not a searchable product database, so they can't be resolved the same
// way. Grouped separately with their own explanation rather than mixed into
// the search-based flow, where an OU/OK link would just come back empty and
// look like a broken tool.
//
// "Missing" means hechsher IS NULL specifically -- not the same as the
// "Not required — raw/unprocessed produce" style strings already on file
// for plenty of real items, which represent an actual reviewed decision,
// not an unreviewed gap.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { isFoodCategory } from '@/lib/foodCategories';
import { ExternalLink } from 'lucide-react';

type Item = { id: string; name: string; category: string | null };

function ouLink(name: string) {
  return `https://oukosher.org/product-search/?search=${encodeURIComponent(name)}`;
}
function okLink(name: string) {
  return `https://www.ok.org/product-search/?search=${encodeURIComponent(name)}`;
}

export default function HechsherVerificationClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, category')
      .eq('property_id', propertyId)
      .is('hechsher', null)
      .order('name');
    setItems((data ?? []).filter((i) => isFoodCategory(i.category)));
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(item: Item, value: string) {
    if (!value.trim()) return;
    setSavingId(item.id);
    const result = await resilientUpdate(supabase, 'inventory_items', { id: item.id }, { hechsher: value.trim() });
    setSavingId(null);
    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    showToast(`${item.name} confirmed.`, { variant: 'success' });
  }

  async function skip(item: Item) {
    setSavingId(item.id);
    const result = await resilientUpdate(
      supabase,
      'inventory_items',
      { id: item.id },
      { hechsher: 'Needs physical label check — not resolvable via online product search' }
    );
    setSavingId(null);
    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  if (!canManage(role)) {
    return <p className="max-w-md mx-auto p-4 text-sm text-dusk">Only an owner or manager can use this tool.</p>;
  }

  if (loading) return <SkeletonList />;

  const meatItems = items.filter((i) => i.category === 'Meat & Seafood');
  const searchableItems = items.filter((i) => i.category !== 'Meat & Seafood');

  function renderRow(item: Item, showLinks: boolean) {
    const draft = drafts[item.id] ?? '';
    const busy = savingId === item.id;
    return (
      <li key={item.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 space-y-2">
        <div>
          <p className="font-medium text-sm text-denim">{item.name}</p>
          {item.category && <p className="text-xs text-dusk">{item.category}</p>}
        </div>

        {showLinks && (
          <div className="flex gap-2 flex-wrap">
            <a
              href={ouLink(item.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brass bg-linen px-2.5 py-1 rounded-full hover:bg-linen"
            >
              Search OU <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
            </a>
            <a
              href={okLink(item.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brass bg-linen px-2.5 py-1 rounded-full hover:bg-linen"
            >
              Search OK <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
            placeholder="e.g. OU, OK, OU-D…"
            className="flex-1 border border-cardBorder rounded-full px-3 py-1.5 text-sm bg-linen"
          />
          <button
            onClick={() => save(item, draft)}
            disabled={busy || !draft.trim()}
            className="text-xs font-medium text-white bg-denim px-3 py-1.5 rounded-full disabled:opacity-40 shrink-0"
          >
            {busy ? '…' : 'Confirm'}
          </button>
        </div>
        <button
          onClick={() => skip(item)}
          disabled={busy}
          className="text-xs text-dusk disabled:opacity-40"
        >
          Skip — needs physical label check
        </button>
      </li>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Hechsher Verification</h1>
      <p className="text-sm text-dusk mb-5">
        {items.length} item{items.length === 1 ? '' : 's'} with no hechsher on file yet.
      </p>

      {searchableItems.length === 0 && meatItems.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-white rounded-2xl shadow-sm shadow-charcoal/5">
          Nothing left to verify.
        </p>
      ) : (
        <>
          {searchableItems.length > 0 && (
            <ul className="space-y-2 mb-6">{searchableItems.map((i) => renderRow(i, true))}</ul>
          )}

          {meatItems.length > 0 && (
            <div>
              <h2 className="font-display text-lg text-denim mb-1">Meat & Seafood</h2>
              <p className="text-xs text-dusk mb-3">
                These depend on the specific butcher or supplier, not a searchable product database — OU/OK
                product search won't resolve them. Confirm directly with the supplier, or skip for a physical
                label check.
              </p>
              <ul className="space-y-2">{meatItems.map((i) => renderRow(i, false))}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
