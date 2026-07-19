// components/QuickPhotoCaptureClient.tsx
// The gap neither existing photo tool actually covers: IdentifyItemClient
// always creates a brand-new pending capture_staging row (AI-named, held
// for later review), and CapturePhotoClient explicitly defers "what item
// is this" to a separate cleanup pass. This is the direct-add path: scan
// or photograph something, name + quantity, straight into inventory_items
// via add_scanned_pantry_item, no review queue.
//
// Camera-first, not search-first (2026-07-19): standing in a pantry
// holding a product, opening to a text field asking you to type was
// backwards. The photo is captured up front and held locally; the form
// below it is just name + quantity, not a search-and-pick list -- the RPC
// does its own upsert-by-name (existing item -> quantity updated, new name
// -> inserted), so there's nothing to search for.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { Camera } from 'lucide-react';
import Pin from '@/components/PinAccent';

type NameSuggestion = { id: string; name: string };

export default function QuickPhotoCaptureClient({ propertyId }: { propertyId: string }) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setName('');
    setQuantity('1');
    setSuggestions([]);
  }

  useEffect(() => {
    if (!name.trim()) {
      setSuggestions([]);
      return;
    }
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('property_id', propertyId)
        .ilike('name', `%${name.trim()}%`)
        .order('name')
        .limit(5);
      setSuggestions(data ?? []);
    }, 300);
    return () => {
      if (nameTimer.current) clearTimeout(nameTimer.current);
    };
  }, [name, propertyId, supabase]);

  async function handleSubmit() {
    if (!capturedFile || !name.trim() || submitting) return;
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) return;
    setSubmitting(true);
    try {
      const compressed = await compressImageToBlob(capturedFile);
      const path = `${propertyId}/scan-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);
      const { data: photoData } = supabase.storage.from('item-photos').getPublicUrl(path);

      // p_ai_category, p_ai_location_hint, p_ai_kosher_guess all left null --
      // this flow has no AI category/location source, and the kosher-guess
      // parameter specifically needs its own real UI treatment (or explicit
      // sign-off that a raw disclaimer line in `notes` is OK for staff to
      // read) before it's ever passed. Not this pass.
      const { data, error } = await supabase.rpc('add_scanned_pantry_item', {
        p_property_id: propertyId,
        p_name: name.trim(),
        p_quantity: qty,
        p_photo_url: photoData.publicUrl,
      });
      if (error) throw new Error(error.message);

      const result = data as { action: 'inserted' | 'updated'; id: string; name: string };

      const { data: itemRow } = await supabase
        .from('inventory_items')
        .select('location_id, locations(name)')
        .eq('id', result.id)
        .single();
      const locationName = (itemRow?.locations as unknown as { name: string } | null)?.name ?? null;

      const mainToast =
        result.action === 'inserted'
          ? t('addedToast', { item: result.name })
          : t('updatedToast', { item: result.name, quantity: qty });
      const locationLine = locationName ? t('landedInLocation', { location: locationName }) : t('noLocationPrompt');

      showToast(`${mainToast} ${locationLine}`, { variant: locationName ? 'success' : 'default' });
      setSavedCount((c) => c + 1);
      retake();
    } catch {
      showToast(t('failedToast'), { variant: 'error' });
    } finally {
      setSubmitting(false);
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
              disabled={submitting}
              className="shrink-0 text-xs text-brass hover:text-denim px-1.5 disabled:opacity-50"
            >
              {t('retake')}
            </button>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-dusk mb-1">{t('nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoFocus
              disabled={submitting}
              className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-2xl px-4 py-2.5 bg-card disabled:opacity-50"
            />
            {suggestions.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setName(s.name)}
                      className="text-xs text-brass bg-mist px-2.5 py-1 rounded-full"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-dusk mb-1">{t('quantityLabel')}</label>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={submitting}
              className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-2xl px-4 py-2.5 bg-card disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full py-3 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
          >
            {submitting ? t('uploading') : t('submitButton')}
          </button>
        </div>
      )}
    </div>
  );
}
