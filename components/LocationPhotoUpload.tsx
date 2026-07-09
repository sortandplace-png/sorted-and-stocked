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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        <h2 className="font-display text-xl text-charcoal mb-1">Photo of {locationName}</h2>
        <p className="text-sm text-charcoal/50 mb-3">
          A real photo of this room/zone — helps everyone recognize it, especially on the Item Lookup view.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-48 object-cover rounded-xl mb-3" />
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/60 text-sm hover:bg-gold-light/10 transition-colors mb-3"
          >
            📸 Tap to take a photo
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={() => onDone()} className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal">
            Cancel
          </button>
          <button
            onClick={savePhoto}
            disabled={!file || saving}
            className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
