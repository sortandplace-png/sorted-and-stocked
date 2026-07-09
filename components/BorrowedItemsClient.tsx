// components/BorrowedItemsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';

type Direction = 'borrowed_from' | 'lent_to';

type Item = {
  id: string;
  item_name: string;
  direction: Direction;
  other_party: string;
  date_out: string | null;
  expected_return: string | null;
  returned: boolean;
  notes: string | null;
};

export default function BorrowedItemsClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemName, setItemName] = useState('');
  const [direction, setDirection] = useState<Direction>('borrowed_from');
  const [otherParty, setOtherParty] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('borrowed_items')
      .select('id, item_name, direction, other_party, date_out, expected_return, returned, notes')
      .eq('property_id', propertyId)
      .order('returned')
      .order('date_out', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem() {
    if (!itemName.trim() || !otherParty.trim()) return;
    setSaving(true);
    const result = await resilientInsert(supabase, 'borrowed_items', {
      property_id: propertyId,
      item_name: itemName.trim(),
      direction,
      other_party: otherParty.trim(),
      date_out: new Date().toISOString().slice(0, 10),
      expected_return: expectedReturn || null,
      returned: false,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added.', { variant: 'success' });
    setItemName('');
    setOtherParty('');
    setExpectedReturn('');
    load();
  }

  async function toggleReturned(item: Item) {
    const result = await resilientUpdate(
      supabase,
      'borrowed_items',
      { id: item.id },
      { returned: !item.returned }
    );
    if (!result.ok) {
      showToast('Failed to update.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, returned: !i.returned } : i)));
  }

  async function removeItem(id: string) {
    const result = await resilientDelete(supabase, 'borrowed_items', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading) return <SkeletonList />;

  const active = items.filter((i) => !i.returned);
  const returned = items.filter((i) => i.returned);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Borrowed &amp; Lent</h1>
      <p className="text-sm text-charcoal/50 mb-4">Keep track of what's out and who has it.</p>

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Log an item</h2>
          <div className="flex bg-cream rounded-full border border-gold-light/60 p-0.5 text-sm">
            <button
              onClick={() => setDirection('borrowed_from')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                direction === 'borrowed_from' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
              }`}
            >
              We borrowed
            </button>
            <button
              onClick={() => setDirection('lent_to')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                direction === 'lent_to' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
              }`}
            >
              We lent
            </button>
          </div>
          <div>
            <FieldLabel>Item</FieldLabel>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Folding chairs, chafing dish"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>{direction === 'borrowed_from' ? 'Borrowed from' : 'Lent to'}</FieldLabel>
            <input
              value={otherParty}
              onChange={(e) => setOtherParty(e.target.value)}
              placeholder={direction === 'borrowed_from' ? 'Who from?' : 'Who to?'}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-charcoal/50 block mb-1">Expected return (optional)</label>
            <input
              type="date"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addItem}
            disabled={saving || !itemName.trim() || !otherParty.trim()}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Log item'}
          </button>
        </div>
      )}

      <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">Still out ({active.length})</h2>
      {active.length === 0 && <p className="text-sm text-charcoal/40 mb-4">Nothing out right now.</p>}
      <ul className="space-y-2 mb-6">
        {active.map((item) => (
          <li key={item.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-charcoal">{item.item_name}</p>
                <p className="text-xs text-charcoal/50">
                  {item.direction === 'borrowed_from' ? 'From' : 'To'} {item.other_party}
                  {item.expected_return && ` · back by ${item.expected_return}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleReturned(item)}
                  className="text-xs font-medium text-gold-dark hover:text-charcoal"
                >
                  Mark returned
                </button>
                {canManage(role) && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-charcoal/30 hover:text-rust"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {returned.length > 0 && (
        <>
          <h2 className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-2">
            Returned ({returned.length})
          </h2>
          <ul className="space-y-2 opacity-60">
            {returned.map((item) => (
              <li key={item.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-charcoal line-through">{item.item_name}</p>
                  {canManage(role) && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-charcoal/30 hover:text-rust"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
