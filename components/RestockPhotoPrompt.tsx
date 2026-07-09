// components/RestockPhotoPrompt.tsx
// Shown right after a restock-quantity save or a new-item save, only when
// the item has no photo_url yet — a shelf-side nudge to capture the real
// product rather than another big backfill push later. Always skippable.
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';

export default function RestockPhotoPrompt({
  itemId,
  itemName,
  propertyId,
  onDone,
}: {
  itemId: string;
  itemName: string;
  propertyId: string;
  onDone: () => void;
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
      const path = `${propertyId}/${crypto.randomUUID()}.jpg`;
      const compressed = await compressImageToBlob(file);
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'inventory_items', { id: itemId }, { photo_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);

      showToast(result.queued ? 'Photo saved — will sync when back online.' : 'Photo saved.', {
        variant: 'success',
      });
    } catch {
      showToast('Failed to save photo.', { variant: 'error' });
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4">
      <div className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto">
        <h2 className="font-display text-xl text-charcoal mb-1">Add a photo?</h2>
        <p className="text-sm text-charcoal/50 mb-3">
          A quick photo of {itemName} on the shelf — optional, helps everyone recognize it next time.
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
          <button onClick={onDone} className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal">
            Skip
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
