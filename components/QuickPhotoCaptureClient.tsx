// components/QuickPhotoCaptureClient.tsx
// The gap neither existing photo tool actually covers: IdentifyItemClient
// always creates a brand-new pending capture_staging row (AI-named, held
// for later review), and CapturePhotoClient explicitly defers "what item
// is this" to a separate cleanup pass. Tonight's 600+-item photo backlog
// is existing items missing photos, not new items -- so this searches
// inventory_items directly and writes photo_url immediately, no review
// queue, so the person actually restocking closes that item's gap on the
// spot instead of it landing in a pile for someone else next month.
//
// Camera-first, not search-first (2026-07-19): standing in a pantry
// holding a product, opening to a text field asking you to type was
// backwards. The photo is captured up front and held locally; search is
// now the second step, used only to say which item the already-taken
// photo belongs to.
'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { Camera, Search } from 'lucide-react';
import Pin from '@/components/PinAccent';

type MatchItem = { id: string; name: string; photo_url: string | null };

export default function QuickPhotoCaptureClient({ propertyId }: { propertyId: string }) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('quickPhotoCapture');

  function handleCameraCapture(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setCapturedFile(file);
    setCapturedPreviewUrl(URL.createObjectURL(file));
  }

  function retake() {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    setQuery('');
    setResults([]);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, photo_url')
        .eq('property_id', propertyId)
        .ilike('name', `%${value.trim()}%`)
        .order('name')
        .limit(8);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
  }

  async function attachToItem(item: MatchItem) {
    if (!capturedFile || uploading) return;
    setUploading(true);
    try {
      const compressed = await compressImageToBlob(capturedFile);
      const path = `${propertyId}/${item.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'inventory_items', { id: item.id }, { photo_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);
      setSavedCount((c) => c + 1);
      showToast(t('savedToast', { item: item.name }), { variant: 'success' });
      retake();
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>

      {savedCount > 0 && (
        <p className="text-xs text-sage font-medium mb-3">{t('sessionCount', { count: savedCount })}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleCameraCapture(e.target.files);
          e.target.value = '';
        }}
      />

      {!capturedFile ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-full flex flex-col items-center justify-center gap-2 rounded-xl2 bg-mist border border-brass/30 py-12 px-4 text-center hover:shadow-card transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <Pin size="sm" />
          <Camera size={32} className="text-denim" aria-hidden="true" />
          <span className="text-sm font-medium text-denim">{t('takePhotoButton')}</span>
        </button>
      ) : (
        <div>
          <div className="relative flex items-center gap-3 bg-card rounded-xl2 shadow-card px-4 py-3 mb-4">
            <Pin size="sm" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedPreviewUrl!} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-mist" />
            <span className="flex-1 text-sm text-dusk">{t('attachToItemPrompt')}</span>
            <button
              type="button"
              onClick={retake}
              disabled={uploading}
              className="shrink-0 text-xs text-brass hover:text-denim px-1.5 disabled:opacity-50"
            >
              {t('retake')}
            </button>
          </div>

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-2xl pl-10 pr-4 py-2.5 bg-card"
              autoFocus
              disabled={uploading}
            />
          </div>

          {searching && <p className="text-xs text-dusk">{t('searching')}</p>}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-dusk">{t('noResults')}</p>
          )}

          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => attachToItem(item)}
                    disabled={uploading}
                    className="w-full flex items-center gap-3 bg-card rounded-2xl shadow-card px-4 py-3 text-left hover:shadow-cardHover transition-shadow disabled:opacity-50"
                  >
                    {item.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-mist" />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-mist shrink-0 flex items-center justify-center text-dusk">
                        <Camera size={16} aria-hidden="true" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-denim truncate">{item.name}</span>
                      {!item.photo_url && <span className="text-xs text-rust">{t('missingPhoto')}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {uploading && <p className="text-xs text-dusk mt-2">{t('uploading')}</p>}
        </div>
      )}
    </div>
  );
}
