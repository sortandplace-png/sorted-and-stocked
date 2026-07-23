// components/BulkPhotoUploadClient.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import CameraCapture from '@/components/CameraCapture';

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
  const [showCamera, setShowCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  async function queuePhotos(files: File[]) {
    if (files.length === 0) return;

    const newEntries: QueuedPhoto[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));
    setQueue((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      const path = `${propertyId}/${entry.key}.jpg`;

      let uploadError: { message: string } | null = null;
      try {
        const compressed = await compressImageToBlob(entry.file);
        ({ error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' }));
      } catch (err) {
        uploadError = { message: err instanceof Error ? err.message : 'Compression failed' };
      }

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

  function handleGalleryFiles(fileList: FileList | null) {
    if (!fileList) return;
    queuePhotos(Array.from(fileList));
  }

  // Camera stays open across shots (CameraCapture isn't closed here) --
  // "Take one photo per item" means many photos in a row, and re-opening
  // getUserMedia after every single frame would be slower and clunkier
  // than just leaving the live feed running until the X is tapped.
  function handleCameraFile(file: File) {
    queuePhotos([file]);
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
      <h1 className="text-2xl font-display text-denim mb-1">Bulk add photos</h1>
      <p className="text-sm text-dusk mb-4">
        Take one photo per item — fill the frame with just that product — then match each
        photo to the right item below.
      </p>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleGalleryFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <CameraCapture open={showCamera} onCapture={handleCameraFile} onClose={() => setShowCamera(false)} />

      {queue.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowCamera(true)}
            className="py-8 rounded-2xl border-2 border-dashed border-cardBorder text-dusk hover:bg-linen transition-colors"
          >
            📸 Take photos
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="py-8 rounded-2xl border-2 border-dashed border-cardBorder text-dusk hover:bg-linen transition-colors"
          >
            🖼️ Choose from library
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 text-xs text-dusk">
            <span>
              {assignedCount} matched · {skippedCount} skipped
              {uploadingCount > 0 ? ` · ${uploadingCount} uploading…` : ''}
            </span>
            <span className="flex items-center gap-2">
              <button onClick={() => setShowCamera(true)} className="text-denim underline">
                + Take more
              </button>
              <button onClick={() => galleryInputRef.current?.click()} className="text-dusk underline">
                Library
              </button>
            </span>
          </div>

          {current ? (
            current.status === 'uploading' ? (
              <div className="text-center py-10 text-sm text-dusk">Uploading photo…</div>
            ) : current.status === 'failed' ? (
              <div className="text-center py-10">
                <p className="text-sm text-rust mb-3">This photo failed to upload.</p>
                <button onClick={skipCurrent} className="text-sm text-denim underline">
                  Skip and continue →
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.previewUrl}
                  alt=""
                  className="w-full h-56 object-contain rounded-xl bg-linen mb-3"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for the matching item…"
                  className="w-full border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen mb-2"
                  autoFocus
                />
                <div className="max-h-56 overflow-y-auto border border-cardBorder rounded-2xl divide-y divide-cardBorder">
                  {filteredItems.slice(0, 30).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => assignTo(item.id)}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-linen"
                    >
                      <span className="flex-1 truncate text-denim">{item.name}</span>
                      {item.photo_url && <span className="text-xs text-sage shrink-0">has photo</span>}
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <p className="px-4 py-3 text-sm text-dusk">No items match that search.</p>
                  )}
                </div>
                <button
                  onClick={skipCurrent}
                  className="w-full text-center text-sm text-dusk mt-3 py-2"
                >
                  Not a product photo — skip →
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-10">
              <p className="font-display text-lg text-denim mb-1">All done!</p>
              <p className="text-sm text-dusk">
                {assignedCount} photo{assignedCount === 1 ? '' : 's'} matched to items.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  className="text-sm font-medium bg-denim text-white px-5 py-2.5 rounded-full"
                >
                  Take more photos
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="text-sm font-medium text-dusk underline px-2"
                >
                  Library
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
