// components/BorrowedItemsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';
import { getEasternDateStr } from '@/lib/eastern-weekday';

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
  // SS-266. NULL means no reminder is sent for this item.
  notify_user_id: string | null;
};

type Member = { userId: string; name: string | null };

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
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // SS-266. Empty string means nobody, which means no reminder -- the
  // deliberate default, not an unset field.
  const [notifyUserId, setNotifyUserId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: memberRows }] = await Promise.all([
      supabase
        .from('borrowed_items')
        .select(
          'id, item_name, direction, other_party, date_out, expected_return, returned, notes, notify_user_id'
        )
        .eq('property_id', propertyId)
        .order('returned')
        .order('date_out', { ascending: false }),
      supabase
        .from('property_members')
        .select('user_id, profiles(full_name, email)')
        .eq('property_id', propertyId),
    ]);
    setItems(data ?? []);
    setMembers(
      (memberRows ?? []).map((m) => {
        const prof = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
        // "Unnamed" is banned (SS-436 reopen): email is the fallback.
        return { userId: m.user_id, name: prof?.full_name?.trim() || prof?.email || null };
      })
    );
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
      // SS-208. Was the UTC date -- from ~8pm Eastern this recorded the
      // wrong day an item actually went out.
      date_out: getEasternDateStr(new Date()),
      expected_return: expectedReturn || null,
      returned: false,
      notes: notes.trim() || null,
      // Empty select -> NULL -> no reminder. Never coerce this to a
      // fallback recipient: texting somebody who was not chosen is worse
      // than sending nothing.
      notify_user_id: notifyUserId || null,
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
    setNotes('');
    setNotifyUserId('');
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

  const q = search.trim().toLowerCase();
  const matchesSearch = (i: Item) =>
    !q || i.item_name.toLowerCase().includes(q) || i.other_party.toLowerCase().includes(q);
  const active = items.filter((i) => !i.returned && matchesSearch(i));
  const returned = items.filter((i) => i.returned && matchesSearch(i));
  // No reminder/notification system exists yet (that's a separate, larger
  // build) -- this is the cheap, real first step: a visible flag on the
  // list itself, comparing expected_return against today's date the same
  // way Inventory's expiring-soon check does (plain string comparison,
  // both "yyyy-MM-dd").
  // SS-208. Was the UTC date -- from ~8pm Eastern this flagged an item
  // overdue a day early, or missed one that just became overdue at
  // midnight Eastern.
  const todayStr = getEasternDateStr(new Date());
  const isOverdue = (i: Item) => !!i.expected_return && i.expected_return < todayStr;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Borrowed &amp; Lent</h1>
      <p className="text-sm text-dusk mb-4">Keep track of what's out and who has it.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search item or name…"
        className="w-full border border-cardBorder rounded-full px-4 py-2.5 bg-card mb-4 text-sm"
      />

      {canManage(role) && (
        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-denim mb-1">Log an item</h2>
          <div className="flex bg-linen rounded-full border border-cardBorder p-0.5 text-sm">
            <button
              onClick={() => setDirection('borrowed_from')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                direction === 'borrowed_from' ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              We borrowed
            </button>
            <button
              onClick={() => setDirection('lent_to')}
              className={`flex-1 py-1.5 rounded-full transition-colors ${
                direction === 'lent_to' ? 'bg-denim text-white' : 'text-dusk'
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
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>{direction === 'borrowed_from' ? 'Borrowed from' : 'Lent to'}</FieldLabel>
            <input
              value={otherParty}
              onChange={(e) => setOtherParty(e.target.value)}
              placeholder={direction === 'borrowed_from' ? 'Who from?' : 'Who to?'}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dusk block mb-1">Expected return (optional)</label>
            <input
              type="date"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            {/* SS-266. Empty option is "nobody" -- the real, intended
                default, not a placeholder waiting to be filled in. Selecting
                nobody means no SMS goes out at the 3-day mark. */}
            <FieldLabel>Notify (optional)</FieldLabel>
            <select
              value={notifyUserId}
              onChange={(e) => setNotifyUserId(e.target.value)}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Don&apos;t send a reminder</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? '—'}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-dusk mt-1">
              They&apos;ll get a text reminder if this isn&apos;t marked returned after 3 days.
            </p>
          </div>
          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. condition, which set, reason"
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addItem}
            disabled={saving || !itemName.trim() || !otherParty.trim()}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Log item'}
          </button>
        </div>
      )}

      <h2 className="text-xs font-medium uppercase tracking-wider text-brass mb-2">Still out ({active.length})</h2>
      {active.length === 0 && <p className="text-sm text-dusk mb-4">Nothing out right now.</p>}
      <ul className="space-y-2 mb-6">
        {active.map((item) => (
          <li
            key={item.id}
            className={`bg-card rounded-xl border shadow-card p-3 ${isOverdue(item) ? 'border-rust' : 'border-cardBorder'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-denim">{item.item_name}</p>
                <p className={`text-xs ${isOverdue(item) ? 'text-rust font-medium' : 'text-dusk'}`}>
                  {item.direction === 'borrowed_from' ? 'From' : 'To'} {item.other_party}
                  {item.expected_return && (isOverdue(item) ? ` · overdue since ${item.expected_return}` : ` · back by ${item.expected_return}`)}
                </p>
                {item.notes && <p className="text-xs text-dusk mt-0.5">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleReturned(item)}
                  className="text-xs font-medium text-brass hover:text-denim"
                >
                  Mark returned
                </button>
                {canManage(role) && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-dusk hover:text-rust"
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
          <h2 className="text-xs font-medium uppercase tracking-wider text-dusk mb-2">
            Returned ({returned.length})
          </h2>
          <ul className="space-y-2 opacity-60">
            {returned.map((item) => (
              <li key={item.id} className="bg-card rounded-xl border border-cardBorder shadow-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-denim line-through">{item.item_name}</p>
                  {canManage(role) && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-dusk hover:text-rust"
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
