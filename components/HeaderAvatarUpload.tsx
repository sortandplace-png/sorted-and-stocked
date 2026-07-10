// components/HeaderAvatarUpload.tsx
// Same upload pattern as LocationPhotoUpload (compress -> upload -> get
// public URL -> resilientUpdate the owning row) targeting profiles.avatar_url
// and the dedicated avatar-photos bucket instead. Wraps the display-only
// Avatar component and makes it clickable to open the upload sheet.
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import Avatar from '@/components/Avatar';

export default function HeaderAvatarUpload({
  userId,
  fullName,
  email,
  avatarUrl,
}: {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const supabase = createClient();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(avatarUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFileSelected(selected: File | null) {
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  function closeModal() {
    setOpen(false);
    setFile(null);
    setPreview(null);
  }

  async function savePhoto() {
    if (!file) return;
    setSaving(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const compressed = await compressImageToBlob(file);
      const { error: uploadError } = await supabase.storage
        .from('avatar-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatar-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'profiles', { id: userId }, { avatar_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);

      setPhotoUrl(data.publicUrl);
      showToast(result.queued ? 'Saved — will sync when back online.' : 'Photo saved.', {
        variant: 'success',
      });
      closeModal();
    } catch {
      showToast('Failed to save photo.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Change your photo" className="rounded-full">
        <Avatar fullName={fullName} email={email} photoUrl={photoUrl} size="sm" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-charcoal mb-1">Your photo</h2>
            <p className="text-sm text-charcoal/50 mb-3">
              Shown next to your name in the header and anywhere else you're credited.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />

            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-32 h-32 rounded-full object-cover mx-auto mb-3" />
            ) : photoUrl ? (
              <div className="flex flex-col items-center gap-2 mb-3">
                <Avatar fullName={fullName} email={email} photoUrl={photoUrl} size="lg" className="w-32 h-32 text-3xl" />
                <button onClick={() => fileInputRef.current?.click()} className="text-sm text-gold-dark font-medium">
                  Change photo
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/60 text-sm hover:bg-gold-light/10 transition-colors mb-3"
              >
                📸 Tap to add a photo
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal">
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
      )}
    </>
  );
}
