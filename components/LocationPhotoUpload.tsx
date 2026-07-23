// components/LocationPhotoUpload.tsx
// Real physical rooms/zones have no manufacturer to source a photo from —
// this is a plain capture-and-upload for staff/Racquel to supply the actual
// shot themselves, same upload pattern as RestockPhotoPrompt but targeting
// `locations` + the dedicated `location-photos` bucket instead.
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import CameraCapture from '@/components/CameraCapture';

export default function LocationPhotoUpload({
  locationId,
  locationName,
  onDone,
}: {
  locationId: string;
  locationName: string;
  onDone: (photoUrl?: string) => void;
}) {
  const supabase = createClient();
  const showToast = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  function handleFileSelected(selected: File | null) {
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function savePhoto() {
    if (!file) return;
    setSaving(true);
    try {
      const path = `${locationId}/${crypto.randomUUID()}.jpg`;
      const compressed = await compressImageToBlob(file);
      const { error: uploadError } = await supabase.storage
        .from('location-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('location-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'locations', { id: locationId }, { photo_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);

      showToast(result.queued ? 'Saved — will sync when back online.' : 'Photo saved.', {
        variant: 'success',
      });
      onDone(data.publicUrl);
    } catch {
      showToast('Failed to save photo.', { variant: 'error' });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
      onClick={() => onDone()}
    >
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-denim mb-1">Photo of {locationName}</h2>
        <p className="text-sm text-dusk mb-3">
          A real photo of this room/zone — helps everyone recognize it, especially on the Item Lookup view.
        </p>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
        />
        <CameraCapture
          open={showCamera}
          onCapture={(f) => {
            setShowCamera(false);
            handleFileSelected(f);
          }}
          onClose={() => setShowCamera(false)}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-48 object-cover rounded-xl mb-3" />
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setShowCamera(true)}
              className="py-8 rounded-2xl border-2 border-dashed border-cardBorder text-dusk text-sm hover:bg-linen transition-colors"
            >
              📸 Take a photo
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="py-8 rounded-2xl border-2 border-dashed border-cardBorder text-dusk text-sm hover:bg-linen transition-colors"
            >
              🖼️ Library
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => onDone()} className="flex-1 py-2.5 rounded-full bg-linen border border-denim/20 text-denim">
            Cancel
          </button>
          <button
            onClick={savePhoto}
            disabled={!file || saving}
            className="flex-1 py-2.5 rounded-full bg-denim text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
