// components/SopPosterUpload.tsx
// SS-124/SS-162: the manager-facing upload/replace/remove control for one
// sop_library row's poster. A self-contained editor for a single row, not a
// page -- per Racquel's own sequencing decision (recorded on SS-162): this
// drops into /staff/sops (via HandbookTabs -> SopLibraryClient) today, and
// moves into the merged Task Center card unchanged whenever SS-156 lands.
//
// Reuses PhotoCropper + lib/compress-image rather than a second crop/upload
// path -- same pattern InventoryClient's photo field already uses.
'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import PhotoCropper from '@/components/PhotoCropper';
import { compressImageToBlob } from '@/lib/compress-image';
import { storageThumbnail } from '@/lib/storage-image';

export default function SopPosterUpload({
  sopId,
  expectedAppearanceUrl,
  photoVerification,
  onUpdated,
}: {
  sopId: string;
  expectedAppearanceUrl: string | null;
  photoVerification: boolean;
  /** Called after a successful write so the parent list can update its own
   *  copy -- this component holds no list state of its own. */
  onUpdated: (patch: { expected_appearance_url: string | null; photo_verification: boolean }) => void;
}) {
  const t = useTranslations('sopLibrary');
  const supabase = createClient();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [saving, setSaving] = useState(false);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChosen(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPendingSrc(URL.createObjectURL(file));
    setShowCropper(true);
  }

  async function handleCropped(blob: Blob) {
    setShowCropper(false);
    setSaving(true);
    try {
      const compressed = await compressImageToBlob(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
      // No property_id in the path -- sop_library is global, not
      // property-scoped (same reasoning as its own RLS, see
      // SopLibraryClient.tsx's header comment).
      const path = `${sopId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('sop-posters')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) {
        showToast(t('posterUploadFailed'), { variant: 'error' });
        return;
      }
      const { data } = supabase.storage.from('sop-posters').getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('sop_library')
        .update({ expected_appearance_url: data.publicUrl })
        .eq('id', sopId);
      if (updateError) {
        showToast(t('posterUploadFailed'), { variant: 'error' });
        return;
      }
      onUpdated({ expected_appearance_url: data.publicUrl, photo_verification: photoVerification });
      showToast(t('posterSaved'), { variant: 'success' });
    } catch {
      showToast(t('posterUploadFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
      if (pendingSrc) URL.revokeObjectURL(pendingSrc);
      setPendingSrc(null);
    }
  }

  async function handleRemove() {
    setSaving(true);
    // Sets the column null; the stored object is left in place (R21 --
    // never delete). A manager can always re-add the same file later, and
    // nothing here is large enough to matter for storage cost.
    const { error } = await supabase
      .from('sop_library')
      .update({ expected_appearance_url: null })
      .eq('id', sopId);
    setSaving(false);
    if (error) {
      showToast(t('posterUploadFailed'), { variant: 'error' });
      return;
    }
    onUpdated({ expected_appearance_url: null, photo_verification: photoVerification });
  }

  async function handleToggleVerification(next: boolean) {
    const { error } = await supabase.from('sop_library').update({ photo_verification: next }).eq('id', sopId);
    if (error) {
      showToast(t('posterUploadFailed'), { variant: 'error' });
      return;
    }
    onUpdated({ expected_appearance_url: expectedAppearanceUrl, photo_verification: next });
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileChosen(e.target.files)}
      />
      {showCropper && pendingSrc && (
        <PhotoCropper
          src={pendingSrc}
          onCancel={() => {
            setShowCropper(false);
            URL.revokeObjectURL(pendingSrc);
            setPendingSrc(null);
          }}
          onCropped={handleCropped}
        />
      )}

      {expectedAppearanceUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={storageThumbnail(expectedAppearanceUrl, 320, 'contain')}
          alt=""
          className="w-full max-h-48 object-contain rounded-xl2 border border-cardBorder bg-mist"
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={pickFile}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full border border-cardBorder text-denim text-sm font-medium disabled:opacity-40"
        >
          <Upload size={14} strokeWidth={1.75} aria-hidden="true" />
          {saving ? t('posterSaving') : expectedAppearanceUrl ? t('posterReplace') : t('posterUpload')}
        </button>
        {expectedAppearanceUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            aria-label={t('posterRemove')}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-cardBorder text-dusk disabled:opacity-40"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <label className="flex items-center justify-between text-xs text-dusk">
        <span>{t('photoVerification')}</span>
        <input
          type="checkbox"
          checked={photoVerification}
          onChange={(e) => handleToggleVerification(e.target.checked)}
          className="h-4 w-4 accent-brass rounded"
        />
      </label>
    </div>
  );
}
