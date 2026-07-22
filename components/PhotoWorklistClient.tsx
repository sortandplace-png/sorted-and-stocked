// components/PhotoWorklistClient.tsx
// The other half of the photo backlog QuickPhotoCaptureClient doesn't
// cover: items where a stock-photo search came back ambiguous or
// unverifiable (generic name, no brand, a name/count combo that doesn't
// match a real current product) -- these need someone to photograph the
// actual item on the shelf, not a closer web search. List-driven rather
// than search-driven since staff shouldn't have to already know which
// items qualify -- inventory_items.photo_needs_sourcing (110) is the
// single source of truth for what belongs here. Each row is a specific
// item in a specific location, shown separately rather than grouped by
// name, since two rows sharing a generic name (e.g. two "Body Lotion"
// entries in different rooms) are exactly the case where they might NOT
// be the same physical product -- that ambiguity is the whole reason
// these landed here instead of being auto-matched.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { Camera } from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';

type WorklistItem = {
  id: string;
  name: string;
  category: string | null;
  location_name: string | null;
};

export default function PhotoWorklistClient({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const pendingItemId = useRef<string | null>(null);
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('photoWorklist');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, category, locations(name)')
        .eq('property_id', propertyId)
        .eq('photo_needs_sourcing', true)
        .or('photo_url.is.null,photo_url.eq.')
        .order('category')
        .order('name');
      setItems(
        (data ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          location_name: (i.locations as unknown as { name: string } | null)?.name ?? null,
        }))
      );
      setLoading(false);
    })();
  }, [propertyId, supabase]);

  function startCapture(itemId: string) {
    pendingItemId.current = itemId;
    setShowCamera(true);
  }

  async function handlePhotoSelected(file: File) {
    const itemId = pendingItemId.current;
    setShowCamera(false);
    if (!file || !itemId) return;
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
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSavedCount((c) => c + 1);
      showToast(t('savedToast', { item: item?.name ?? '' }), { variant: 'success' });
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setUploadingId(null);
      pendingItemId.current = null;
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
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

      {loading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <p className="text-sm text-dusk text-center mt-8">{t('allDone')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => startCapture(item.id)}
                disabled={uploadingId === item.id}
                className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3 text-left hover:shadow-md transition-shadow disabled:opacity-50"
              >
                <span className="w-10 h-10 rounded-lg bg-linen shrink-0 flex items-center justify-center text-dusk">
                  <Camera size={16} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-denim truncate">{item.name}</span>
                  <span className="block text-xs text-dusk truncate">
                    {[item.category, item.location_name].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-brass font-medium">
                  {uploadingId === item.id ? t('uploading') : t('takePhotoButton')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
