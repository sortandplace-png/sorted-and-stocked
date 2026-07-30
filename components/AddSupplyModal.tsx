// components/AddSupplyModal.tsx
// Write path for task_supplies. Picks an existing inventory item rather
// than free-typing a product name -- the whole value of this table is the
// join to inventory_items (and through it to the reorder link), so a
// text-only supply would render with no link and defeat the point.
//
// supplier_id is left null: it is nullable, the suppliers table is
// property-scoped and currently has no row for the retailer on the one
// real supply that exists, and the reorder link already comes off the item.
// Wiring a supplier picker here would be inventing a second, competing
// answer to "where do I buy this" -- flagged rather than guessed.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import Pin from '@/components/PinAccent';

type PickableItem = { id: string; name: string; name_es: string | null };

export default function AddSupplyModal({
  propertyId,
  taskId,
  existingItemIds = [],
  onClose,
  onSaved,
}: {
  propertyId: string;
  taskId: string;
  /** Items already on this task. task_supplies has UNIQUE (task_id,
   *  inventory_item_id), so offering one of these would only produce a
   *  constraint violation at save time -- filtered out of the picker
   *  instead of letting someone pick a doomed option. */
  existingItemIds?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('taskSupplies');
  const locale = useLocale();
  const supabase = createClient();

  const [items, setItems] = useState<PickableItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PickableItem | null>(null);
  const [noteEn, setNoteEn] = useState('');
  const [noteEs, setNoteEs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Scoped to this property -- a supply for a task at one house must not
    // be able to point at another house's inventory row.
    (async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, name_es')
        .eq('property_id', propertyId)
        .order('name');
      setItems((data as PickableItem[]) ?? []);
    })();
  }, [propertyId, supabase]);

  const label = (i: PickableItem) => (locale === 'es' ? i.name_es || i.name : i.name);

  // Both languages searchable regardless of UI locale, same rule
  // SopLibraryClient's own search uses.
  const filtered = useMemo(() => {
    const taken = new Set(existingItemIds);
    const pool = items.filter((i) => !taken.has(i.id));
    const q = search.trim().toLowerCase();
    if (!q) return pool.slice(0, 30);
    return pool
      .filter((i) => [i.name, i.name_es].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .slice(0, 30);
  }, [items, search, existingItemIds]);

  async function save() {
    if (!selected) {
      setError(t('pickAnItem'));
      return;
    }
    // R19: bilingual at creation. The note is what a staff member actually
    // reads off this row, so an English-only note is unusable to half the
    // people it exists for.
    if (!noteEn.trim() || !noteEs.trim()) {
      setError(t('bothLanguagesRequired'));
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('task_supplies').insert({
      task_id: taskId,
      inventory_item_id: selected.id,
      supplier_id: null,
      note_en: noteEn.trim(),
      note_es: noteEs.trim(),
    });

    setSaving(false);
    if (insertError) {
      // 23505 = the UNIQUE (task_id, inventory_item_id) constraint. The
      // picker already filters these out, so reaching here means two people
      // added the same supply at once -- a real race, not a normal path.
      // Either way a raw Postgres constraint string is not something to put
      // in front of a user.
      setError(insertError.code === '23505' ? t('alreadyAdded') : insertError.message || t('saveFailed'));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-card rounded-xl3 shadow-card p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Pin size="sm" />
        <h2 className="font-display text-[22px] text-denim mb-4">{t('addSupplyTitle')}</h2>

        {error && <p className="mb-3 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{error}</p>}

        {selected ? (
          <div className="mb-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
              {t('selectedItem')}
            </label>
            <div className="flex items-center gap-2 bg-mist rounded-xl2 px-3 py-2">
              <span className="flex-1 text-sm text-denim truncate">{label(selected)}</span>
              <button onClick={() => setSelected(null)} className="text-dusk hover:text-denim text-xs px-1">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim mb-2"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto rounded-xl2 border border-cardBorder">
              {filtered.length === 0 ? (
                // "nothing matched your search" and "this property has no
                // inventory at all" are different problems -- Lax has 79
                // tasks and zero items, so the second is the common case
                // and the search-flavoured wording sent people looking for
                // a typo that was never there.
                <p className="text-xs text-dusk px-3 py-2">
                  {items.length === 0 ? t('noItemsYet') : t('noMatches')}
                </p>
              ) : (
                <ul>
                  {filtered.map((i) => (
                    <li key={i.id}>
                      <button
                        onClick={() => setSelected(i)}
                        className="w-full text-left px-3 py-2 text-sm text-denim hover:bg-mist"
                      >
                        {label(i)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
              {t('noteEn')}
            </label>
            <textarea
              value={noteEn}
              onChange={(e) => setNoteEn(e.target.value)}
              rows={2}
              placeholder={t('notePlaceholder')}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
              {t('noteEs')}
            </label>
            <textarea
              value={noteEs}
              onChange={(e) => setNoteEs(e.target.value)}
              rows={2}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim text-sm font-medium"
          >
            {t('cancel')}
          </button>
          <button
            onClick={save}
            disabled={saving || !selected || !noteEn.trim() || !noteEs.trim()}
            className="flex-1 py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
