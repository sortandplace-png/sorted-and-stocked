// components/ReorderSourcesEditor.tsx
// Full CRUD for one item's reorder_sources -- slots into ItemFormSheet the
// same way InventoryBracha does: itemId-scoped, fetches and saves itself
// independently of the parent form's own Save button, only shown once the
// item actually exists (gated on form.id upstream, same as InventoryBracha
// and the History section -- there's no inventory_item_id to attach a
// source to before the item has been created at least once).
//
// Add/rename/re-URL are plain resilientInsert/resilientUpdate calls.
// Set-preferred and delete both need to touch more than one row
// atomically (unset the old preferred, or promote the next one), so those
// go through the set_preferred_reorder_source / delete_reorder_source
// Postgres functions instead -- see supabase/migrations/093 for why.
// Delete follows this file's established no-confirm()-dialog convention
// (see InventoryClient's deleteItem): optimistic removal + a 5s "Undo"
// toast, not a blocking confirm prompt.
//
// Unlike the rest of InventoryClient.tsx (still hardcoded English -- a
// pre-existing gap, not introduced here), this component is translated:
// EN/ES was an explicit requirement for this feature specifically.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import type { ReorderSource } from '@/lib/reorder-sources';

const fieldClass =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-2xl px-3 py-2 text-sm bg-mist';

export default function ReorderSourcesEditor({ itemId, propertyId }: { itemId: string; propertyId: string }) {
  const [sources, setSources] = useState<ReorderSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRetailer, setEditRetailer] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRetailer, setNewRetailer] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const showToast = useToast();
  const role = usePropertyRole();
  const supabase = createClient();
  const t = useTranslations('reorderSources');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('reorder_sources')
        .select('id, retailer_name, url, is_preferred')
        .eq('inventory_item_id', itemId)
        .order('is_preferred', { ascending: false })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setSources(data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleAdd() {
    const retailer = newRetailer.trim();
    const url = newUrl.trim();
    if (!retailer || !url) return;
    setAdding(true);
    const isFirst = sources.length === 0;
    const result = await resilientInsert(supabase, 'reorder_sources', {
      property_id: propertyId,
      inventory_item_id: itemId,
      retailer_name: retailer,
      url,
      is_preferred: isFirst,
    });
    setAdding(false);
    if (!result.ok) {
      showToast(result.error ?? t('addFailedToast'), { variant: 'error' });
      return;
    }
    const { data } = await supabase
      .from('reorder_sources')
      .select('id, retailer_name, url, is_preferred')
      .eq('inventory_item_id', itemId)
      .order('is_preferred', { ascending: false })
      .order('created_at', { ascending: true });
    setSources(data ?? []);
    setNewRetailer('');
    setNewUrl('');
    setShowAddForm(false);
    showToast(result.queued ? t('queuedToast') : t('addedToast', { retailer }), { variant: 'success' });
  }

  function startEdit(source: ReorderSource) {
    setEditingId(source.id);
    setEditRetailer(source.retailer_name);
    setEditUrl(source.url);
  }

  async function handleSaveEdit(id: string) {
    const retailer = editRetailer.trim();
    const url = editUrl.trim();
    if (!retailer || !url) return;
    setSavingEdit(true);
    const result = await resilientUpdate(supabase, 'reorder_sources', { id }, { retailer_name: retailer, url });
    setSavingEdit(false);
    if (!result.ok) {
      showToast(result.error ?? t('saveFailedToast'), { variant: 'error' });
      return;
    }
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, retailer_name: retailer, url } : s)));
    setEditingId(null);
    showToast(result.queued ? t('queuedToast') : t('updatedToast'), { variant: 'success' });
  }

  async function handleSetPreferred(id: string) {
    const previous = sources;
    setSources((prev) => prev.map((s) => ({ ...s, is_preferred: s.id === id })));
    const { error } = await supabase.rpc('set_preferred_reorder_source', { p_id: id });
    if (error) {
      setSources(previous);
      showToast(t('setPreferredFailedToast'), { variant: 'error' });
    }
  }

  function handleDelete(id: string) {
    const source = sources.find((s) => s.id === id);
    if (!source) return;
    const previous = sources;

    let next = sources.filter((s) => s.id !== id);
    if (source.is_preferred && next.length > 0) {
      // Mirrors delete_reorder_source's own promotion rule (oldest
      // remaining) so the UI doesn't show zero preferred during the undo
      // window, before the real delete has even run.
      next = next.map((s, i) => ({ ...s, is_preferred: i === 0 }));
    }
    setSources(next);

    const timer = setTimeout(async () => {
      pendingDeleteTimers.current.delete(id);
      const { error } = await supabase.rpc('delete_reorder_source', { p_id: id });
      if (error) {
        showToast(t('deleteFailedToast'), { variant: 'error' });
        setSources(previous);
      }
    }, 5000);
    pendingDeleteTimers.current.set(id, timer);

    showToast(t('removedToast', { retailer: source.retailer_name }), {
      variant: 'default',
      action: {
        label: t('undo'),
        onClick: () => {
          const pending = pendingDeleteTimers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            pendingDeleteTimers.current.delete(id);
          }
          setSources(previous);
        },
      },
    });
  }

  if (loading) return null;

  return (
    <div className="mt-5 pt-4 border-t border-cardBorder">
      <p className="text-xs font-display italic text-dusk mb-2">{t('heading')}</p>

      {sources.length === 0 && !showAddForm && <p className="text-xs text-dusk mb-2">{t('empty')}</p>}

      {sources.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {sources.map((source) =>
            editingId === source.id ? (
              <li key={source.id} className="bg-mist rounded-2xl p-2.5 space-y-1.5">
                <input
                  className={fieldClass}
                  placeholder={t('retailerPlaceholder')}
                  value={editRetailer}
                  onChange={(e) => setEditRetailer(e.target.value)}
                />
                <input
                  className={fieldClass}
                  placeholder={t('urlPlaceholder')}
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex-1 py-1.5 rounded-full bg-card border border-brass/30 text-denim text-xs"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(source.id)}
                    disabled={savingEdit || !editRetailer.trim() || !editUrl.trim()}
                    className="flex-1 py-1.5 rounded-full bg-denim text-white text-xs disabled:opacity-40"
                  >
                    {savingEdit ? t('saving') : t('save')}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={source.id}
                className="flex items-center gap-2 bg-mist border border-cardBorder rounded-2xl px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleSetPreferred(source.id)}
                  disabled={source.is_preferred}
                  title={source.is_preferred ? t('preferredTitle') : t('makePreferredTitle')}
                  className={`shrink-0 text-sm ${source.is_preferred ? 'text-brass' : 'text-dusk/50 hover:text-dusk'}`}
                  aria-label={source.is_preferred ? t('preferredTitle') : t('makePreferredTitle')}
                >
                  {source.is_preferred ? '★' : '☆'}
                </button>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm text-denim truncate"
                  title={source.url}
                >
                  {source.retailer_name}
                </a>
                <button
                  type="button"
                  onClick={() => startEdit(source)}
                  className="shrink-0 text-xs text-dusk hover:text-denim px-1.5"
                >
                  {t('edit')}
                </button>
                {canManage(role) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(source.id)}
                    className="shrink-0 text-xs text-rust px-1.5"
                  >
                    {t('delete')}
                  </button>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {showAddForm ? (
        <div className="bg-mist rounded-2xl p-2.5 space-y-1.5">
          <input
            className={fieldClass}
            placeholder={t('retailerPlaceholder')}
            value={newRetailer}
            onChange={(e) => setNewRetailer(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder={t('urlPlaceholder')}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewRetailer('');
                setNewUrl('');
              }}
              className="flex-1 py-1.5 rounded-full bg-card border border-brass/30 text-denim text-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newRetailer.trim() || !newUrl.trim()}
              className="flex-1 py-1.5 rounded-full bg-denim text-white text-xs disabled:opacity-40"
            >
              {adding ? t('adding') : t('add')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 rounded-2xl border-2 border-dashed border-brass/40 text-dusk text-xs font-medium hover:bg-mist transition"
        >
          {t('addButton')}
        </button>
      )}
    </div>
  );
}
