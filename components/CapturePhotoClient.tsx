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
import CameraCapture from '@/components/CameraCapture';

type QueuedPhoto = {
  key: string;
  previewUrl: string;
  status: 'uploading' | 'saved' | 'failed';
};

export default function CapturePhotoClient({ propertyId }: { propertyId: string }) {
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function queuePhotos(files: File[]) {
    if (files.length === 0) return;

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

  function handleGalleryFiles(fileList: FileList | null) {
    if (!fileList) return;
    queuePhotos(Array.from(fileList));
  }

  // Camera stays open across shots -- "snap as many as you need" is the
  // whole point of this tool, and closing/reopening getUserMedia between
  // every single photo would work against that.
  function handleCameraFile(file: File) {
    queuePhotos([file]);
  }

  const savedCount = queue.filter((q) => q.status === 'saved').length;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Capture Photo</h1>
      <p className="text-sm text-charcoal/50 mb-5">
        Snap as many photos as you need — each one saves right away. No need to say what it is yet.
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
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => setShowCamera(true)}
          className="py-10 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/70 hover:bg-gold-light/10 transition-colors"
        >
          📸 Take a photo
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="py-10 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/70 hover:bg-gold-light/10 transition-colors"
        >
          🖼️ Library
        </button>
      </div>

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
