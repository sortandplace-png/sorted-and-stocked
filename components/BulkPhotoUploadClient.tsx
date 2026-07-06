// components/BulkPhotoUploadClient.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

type Item = {
  id: string;
  name: string;
  photo_url: string | null;
};

type QueuedPhoto = {
  key: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'ready' | 'assigned' | 'skipped' | 'failed';
  storagePath?: string;
  publicUrl?: string;
};

export default function BulkPhotoUploadClient({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [cursor, setCursor] = useState(0);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const showToast = useToast();

  useEffect(() => {
    supabase
      .from('inventory_items')
      .select('id, name, photo_url')
      .eq('property_id', propertyId)
      .order('name')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const newEntries: QueuedPhoto[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));
    setQueue((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      const ext = entry.file.name.split('.').pop() || 'jpg';
      const path = `${propertyId}/${entry.key}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, entry.file, { contentType: entry.file.type || 'image/jpeg' });

      setQueue((prev) =>
        prev.map((q) => {
          if (q.key !== entry.key) return q;
          if (uploadError) return { ...q, status: 'failed' };
          const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
          return { ...q, status: 'ready', storagePath: path, publicUrl: data.publicUrl };
        })
      );
    }
  }

  async function assignTo(itemId: string) {
    const photo = queue[cursor];
    if (!photo || !photo.publicUrl) return;

    const { error } = await supabase
      .from('inventory_items')
      .update({ photo_url: photo.publicUrl })
      .eq('id', itemId);

    if (error) {
      showToast('Failed to save photo to item.', { variant: 'error' });
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, photo_url: photo.publicUrl! } : i)));
    setQueue((prev) => prev.map((q, i) => (i === cursor ? { ...q, status: 'assigned' } : q)));
    setSearch('');
    setCursor((c) => c + 1);
  }

  function skipCurrent() {
    setQueue((prev) => prev.map((q, i) => (i === cursor ? { ...q, status: 'skipped' } : q)));
    setSearch('');
    setCursor((c) => c + 1);
  }

  const current = queue[cursor];
  const readyCount = queue.filter((q) => q.status === 'ready').length;
  const assignedCount = queue.filter((q) => q.status === 'assigned').length;
  const skippedCount = queue.filter((q) => q.status === 'skipped').length;
  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;

  const filteredItems = items
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Items still missing a photo bubble to the top — that's the common case.
      const aHas = a.photo_url ? 1 : 0;
      const bHas = b.photo_url ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return a.name.localeCompare(b.name);
    });

  if (loading) return null;

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-display text-aubergine mb-1">Bulk add photos</h1>
      <p className="text-sm text-ink/50 mb-4">
        Take one photo per item — fill the frame with just that product — then match each
        photo to the right item below.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {queue.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-8 rounded-2xl border-2 border-dashed border-gold-light text-aubergine/70 hover:bg-gold-light/10 transition-colors"
        >
          📸 Tap to choose or take photos
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 text-xs text-ink/50">
            <span>
              {assignedCount} matched · {skippedCount} skipped
              {uploadingCount > 0 ? ` · ${uploadingCount} uploading…` : ''}
            </span>
            <button onClick={() => fileInputRef.current?.click()} className="text-aubergine underline">
              + Add more photos
            </button>
          </div>

          {current ? (
            current.status === 'uploading' ? (
              <div className="text-center py-10 text-sm text-ink/40">Uploading photo…</div>
            ) : current.status === 'failed' ? (
              <div className="text-center py-10">
                <p className="text-sm text-rust mb-3">This photo failed to upload.</p>
                <button onClick={skipCurrent} className="text-sm text-aubergine underline">
                  Skip and continue →
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.previewUrl}
                  alt=""
                  className="w-full h-56 object-contain rounded-xl bg-cream/40 mb-3"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for the matching item…"
                  className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-2"
                  autoFocus
                />
                <div className="max-h-56 overflow-y-auto border border-gold-light/40 rounded-2xl divide-y divide-gold-light/20">
                  {filteredItems.slice(0, 30).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => assignTo(item.id)}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-gold-light/10"
                    >
                      <span className="flex-1 truncate text-ink">{item.name}</span>
                      {item.photo_url && <span className="text-xs text-sage shrink-0">has photo</span>}
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="px-4 py-3 text-sm text-ink/40">No items match that search.</p>
                  )}
                </div>
                <button
                  onClick={skipCurrent}
                  className="w-full text-center text-sm text-ink/40 mt-3 py-2"
                >
                  Not a product photo — skip →
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-10">
              <p className="font-display text-lg text-aubergine mb-1">All done!</p>
              <p className="text-sm text-ink/50">
                {assignedCount} photo{assignedCount === 1 ? '' : 's'} matched to items.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 text-sm font-medium bg-aubergine text-cream px-5 py-2.5 rounded-full"
              >
                Add more photos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
