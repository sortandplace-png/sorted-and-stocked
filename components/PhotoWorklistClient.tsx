// components/PhotoWorklistClient.tsx
// The other half of the photo backlog QuickPhotoCaptureClient doesn't
// cover: items where a stock-photo search came back ambiguous or
// unverifiable (generic name, no brand, a name/count combo that doesn't
// match a real current product) -- these need someone to photograph the
// actual item on the shelf, not a closer web search. List-driven rather
// than search-driven since staff shouldn't have to already know which
// items qualify -- photo_url IS NULL on inventory_items is the single
// source of truth for what belongs here (SS-869: NOT
// photo_needs_sourcing, an unmaintained flag that let Henderson's real
// 175-item backlog render as "nothing left"). Each row is a specific item
// in a specific location, shown separately rather than grouped by name,
// since two rows sharing a generic name (e.g. two "Body Lotion" entries in
// different rooms) are exactly the case where they might NOT be the same
// physical product -- that ambiguity is why an exact-name candidate is
// offered as a SUGGESTION here, never auto-attached.
'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { Camera, Image as ImageIcon } from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';

export type WorklistItem = {
  id: string;
  name: string;
  category: string | null;
  location_name: string | null;
};

// SS-869 part 2. Server-computed (app/properties/[id]/tools/photo-worklist/
// page.tsx) via two exact-match passes -- name equality, then
// item_name_synonyms -- never fuzzy matching. otherCount is how many
// additional houses also have a photo under this name; the UI shows only
// the alphabetically-first one plus that count, never a picker (Racquel's
// ruling: build one only if she asks for it).
export type PhotoSuggestion = {
  photoUrl: string;
  propertyLabel: string;
  otherCount: number;
};

export default function PhotoWorklistClient({
  propertyId,
  initialItems,
  initialSuggestions,
}: {
  propertyId: string;
  initialItems: WorklistItem[];
  initialSuggestions: Record<string, PhotoSuggestion>;
}) {
  const [items, setItems] = useState<WorklistItem[]>(initialItems);
  const [suggestions] = useState<Record<string, PhotoSuggestion>>(initialSuggestions);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const pendingItemId = useRef<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('photoWorklist');

  function startCapture(itemId: string) {
    pendingItemId.current = itemId;
    setShowCamera(true);
  }

  // SS-869 part 1. Racquel is on a laptop, where the camera flow has no
  // working action at all -- this is the second affordance, same upload
  // path/bucket/filename convention as the camera capture below, just a
  // different source for the File. Established pattern (QuickPhotoCaptureClient):
  // a plain <input type="file"> for "choose from library", getUserMedia
  // (CameraCapture) for a guaranteed real camera -- capture="environment"
  // on a file input is a suggestion browsers are free to ignore, confirmed
  // live on a real device.
  function startFilePicker(itemId: string) {
    pendingItemId.current = itemId;
    galleryInputRef.current?.click();
  }

  function removeFromList(itemId: string, name: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setSavedCount((c) => c + 1);
    showToast(t('savedToast', { item: name }), { variant: 'success' });
  }

  async function uploadPhoto(itemId: string, file: File) {
    setUploadingId(itemId);
    try {
      const compressed = await compressImageToBlob(file);
      const path = `${propertyId}/${itemId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'inventory_items', { id: itemId }, {
        photo_url: data.publicUrl,
        photo_needs_sourcing: false,
      });
      if (!result.ok) throw new Error(result.error);
      const item = items.find((i) => i.id === itemId);
      removeFromList(itemId, item?.name ?? '');
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setUploadingId(null);
      pendingItemId.current = null;
    }
  }

  async function handlePhotoSelected(file: File) {
    const itemId = pendingItemId.current;
    setShowCamera(false);
    if (!file || !itemId) return;
    await uploadPhoto(itemId, file);
  }

  function handleGallerySelected(fileList: FileList | null) {
    const itemId = pendingItemId.current;
    const file = fileList?.[0];
    if (!file || !itemId) return;
    void uploadPhoto(itemId, file);
  }

  // SS-869 part 2. SUGGEST, NEVER AUTO-ATTACH: this is the entire
  // interaction, one human tap that copies an existing photo_url onto
  // this item. Never overwrites -- every row here already has photo_url
  // IS NULL by construction (the page's own query), so there is nothing
  // to protect beyond not calling this twice on the same row, which the
  // acceptingId guard below prevents.
  async function useThisPhoto(item: WorklistItem, suggestion: PhotoSuggestion) {
    setAcceptingId(item.id);
    try {
      const result = await resilientUpdate(supabase, 'inventory_items', { id: item.id }, {
        photo_url: suggestion.photoUrl,
        photo_needs_sourcing: false,
      });
      if (!result.ok) throw new Error(result.error);
      removeFromList(item.id, item.name);
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>

      {savedCount > 0 && (
        <p className="text-xs text-sage font-medium mb-3">{t('sessionCount', { count: savedCount })}</p>
      )}

      <CameraCapture
        open={showCamera}
        onCapture={handlePhotoSelected}
        onClose={() => {
          setShowCamera(false);
          pendingItemId.current = null;
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleGallerySelected(e.target.files);
          e.target.value = '';
        }}
      />

      {items.length === 0 ? (
        <p className="text-sm text-dusk text-center mt-8">{t('allDone')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const suggestion = suggestions[item.id];
            const busy = uploadingId === item.id || acceptingId === item.id;
            return (
              <li key={item.id} className="bg-white rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="w-10 h-10 rounded-lg bg-linen shrink-0 flex items-center justify-center text-dusk">
                    <Camera size={16} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-denim truncate">{item.name}</span>
                    <span className="block text-xs text-dusk truncate">
                      {[item.category, item.location_name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startCapture(item.id)}
                      disabled={busy}
                      className="w-9 h-9 flex items-center justify-center rounded-full border border-brass/30 text-denim disabled:opacity-40"
                      aria-label={t('takePhotoButton')}
                      title={t('takePhotoButton')}
                    >
                      <Camera size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startFilePicker(item.id)}
                      disabled={busy}
                      className="w-9 h-9 flex items-center justify-center rounded-full border border-brass/30 text-denim disabled:opacity-40"
                      aria-label={t('choosePhotoButton')}
                      title={t('choosePhotoButton')}
                    >
                      <ImageIcon size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* SS-869 part 2: the business already owns most of these
                    pictures. Source always named -- a silent copy is the
                    failure mode here, not a slow one. */}
                {suggestion && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-mist border-t border-cardBorder">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={suggestion.photoUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-cardBorder"
                    />
                    <span className="flex-1 min-w-0 text-xs text-dusk">
                      {t('suggestionFrom', { property: suggestion.propertyLabel })}
                      {suggestion.otherCount > 0 && (
                        <span className="block">{t('suggestionOthers', { count: suggestion.otherCount })}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => useThisPhoto(item, suggestion)}
                      disabled={busy}
                      className="shrink-0 text-xs font-medium bg-denim text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                    >
                      {acceptingId === item.id ? t('uploading') : t('useThisPhoto')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
