// components/CapturePhotoClient.tsx
// Photo first, form second -- the old Bulk Photo Upload made staff search
// for a matching inventory item before the next photo could be taken.
// Here, taking a photo is the entire interaction: it uploads and lands in
// capture_staging (capture_type: 'photo', migration 083) immediately,
// ready for the next shot. Deciding what each photo actually belongs to
// (a room or an inventory item) is a separate, later step -- Admin
// Cleanup's Link Captured Photos tool, not something staff do here.
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';

type QueuedPhoto = {
  key: string;
  previewUrl: string;
  status: 'uploading' | 'saved' | 'failed';
};

export default function CapturePhotoClient({ propertyId }: { propertyId: string }) {
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const newEntries: QueuedPhoto[] = files.map((file) => ({
      key: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));
    setQueue((prev) => [...newEntries, ...prev]);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = newEntries[i].key;
      const path = `${propertyId}/${key}.jpg`;

      try {
        const compressed = await compressImageToBlob(file);
        const { error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
        const { error: insertError } = await supabase.from('capture_staging').insert({
          property_id: propertyId,
          submitted_by: user?.id ?? null,
          capture_type: 'photo',
          raw_payload: { photo_url: data.publicUrl },
        });
        if (insertError) throw insertError;

        setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, status: 'saved' } : q)));
      } catch {
        setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, status: 'failed' } : q)));
      }
    }
  }

  const savedCount = queue.filter((q) => q.status === 'saved').length;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Capture Photo</h1>
      <p className="text-sm text-charcoal/50 mb-5">
        Snap as many photos as you need — each one saves right away. No need to say what it is yet.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-10 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/70 hover:bg-gold-light/10 transition-colors mb-5"
      >
        📸 Tap to take a photo
      </button>

      {queue.length > 0 && (
        <>
          <p className="text-xs text-charcoal/50 mb-3">{savedCount} of {queue.length} saved</p>
          <div className="grid grid-cols-3 gap-2">
            {queue.map((item) => (
              <div key={item.key} className="relative rounded-xl overflow-hidden bg-cream/40 aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white">…</div>
                )}
                {item.status === 'failed' && (
                  <div className="absolute inset-0 bg-rust/70 flex items-center justify-center text-xs text-white">Failed</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {savedCount > 0 && queue.every((q) => q.status !== 'uploading') && (
        <p className="text-sm text-center text-charcoal/50 mt-5">
          Done for now? Whoever's on cleanup duty will match these up later.
        </p>
      )}
    </div>
  );
}
