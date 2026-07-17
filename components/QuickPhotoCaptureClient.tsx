// components/QuickPhotoCaptureClient.tsx
// The gap neither existing photo tool actually covers: IdentifyItemClient
// always creates a brand-new pending capture_staging row (AI-named, held
// for later review), and CapturePhotoClient explicitly defers "what item
// is this" to a separate cleanup pass. Tonight's 600+-item photo backlog
// is existing items missing photos, not new items -- so this searches
// inventory_items directly and writes photo_url immediately, no review
// queue, so the person actually restocking closes that item's gap on the
// spot instead of it landing in a pile for someone else next month.
'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { Camera, Search } from 'lucide-react';

type MatchItem = { id: string; name: string; photo_url: string | null };

export default function QuickPhotoCaptureClient({ propertyId }: { propertyId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MatchItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('quickPhotoCapture');

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
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

  async function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const compressed = await compressImageToBlob(file);
      const path = `${propertyId}/${selected.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
      const result = await resilientUpdate(supabase, 'inventory_items', { id: selected.id }, { photo_url: data.publicUrl });
      if (!result.ok) throw new Error(result.error);
      setSavedCount((c) => c + 1);
      showToast(t('savedToast', { item: selected.name }), { variant: 'success' });
      setSelected(null);
      setQuery('');
      setResults([]);
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">{t('title')}</h1>
      <p className="text-sm text-charcoal/50 mb-5">{t('subtitle')}</p>

      {savedCount > 0 && (
        <p className="text-xs text-sage font-medium mb-3">{t('sessionCount', { count: savedCount })}</p>
      )}

      {!selected ? (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl pl-10 pr-4 py-2.5 bg-cream/40"
              autoFocus
            />
          </div>

          {searching && <p className="text-xs text-charcoal/40">{t('searching')}</p>}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-charcoal/40">{t('noResults')}</p>
          )}

          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3 text-left hover:shadow-md transition-shadow"
                  >
                    {item.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gold-light/20" />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-gold-light/20 shrink-0 flex items-center justify-center text-charcoal/30">
                        <Camera size={16} aria-hidden="true" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-charcoal truncate">{item.name}</span>
                      {!item.photo_url && <span className="text-xs text-rust">{t('missingPhoto')}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3 mb-4">
            {selected.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gold-light/20" />
            ) : (
              <span className="w-10 h-10 rounded-lg bg-gold-light/20 shrink-0 flex items-center justify-center text-charcoal/30">
                <Camera size={16} aria-hidden="true" />
              </span>
            )}
            <span className="flex-1 font-medium text-charcoal truncate">{selected.name}</span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs text-charcoal/50 hover:text-charcoal px-1.5"
            >
              {t('changeItem')}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handlePhotoSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-10 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/70 hover:bg-gold-light/10 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
          >
            <Camera size={28} aria-hidden="true" />
            <span>{uploading ? t('uploading') : t('takePhotoButton')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
