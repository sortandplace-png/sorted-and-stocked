// components/IdentifyItemClient.tsx
// For a genuinely new/unlisted item — not a barcode (Scan a Label) and not
// a label close-up (Ingredient Scanner). AI suggests a name only, never
// category or kosher_type (kept out on purpose — this app never lets AI
// guess kosher_type, see the pesach_status/hechsher work). Lands as a
// pending 'inventory' capture_staging row, same Capture Inbox review step
// as every other capture path, not a direct inventory_items write.
'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob, compressImageToDataUrl } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';

type Step = 'idle' | 'identifying' | 'confirming' | 'saving' | 'done';

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await compressImageToDataUrl(file, { maxDimension: 1200 });
  const base64 = dataUrl.replace(/^data:[^,]*,/, '');
  return { data: base64, mediaType: 'image/jpeg' };
}

export default function IdentifyItemClient({ propertyId }: { propertyId: string }) {
  const [step, setStep] = useState<Step>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const showToast = useToast();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setError(null);
    setName('');
    setStep('identifying');

    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/tools/identify-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, imageBase64: data, mediaType }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't identify this photo — type the name in yourself.");
        setUncertain(true);
      } else {
        setName(body.name ?? '');
        setUncertain(!!body.uncertain);
      }
    } catch {
      setError("Couldn't reach the identifier — type the name in yourself.");
      setUncertain(true);
    } finally {
      setStep('confirming');
    }
  }

  async function handleAdd() {
    const file = fileRef.current;
    if (!file || !name.trim()) return;
    setStep('saving');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const key = crypto.randomUUID();
      const path = `${propertyId}/${key}.jpg`;
      const compressed = await compressImageToBlob(file);
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('item-photos').getPublicUrl(path);
      const { error: insertError } = await supabase.from('capture_staging').insert({
        property_id: propertyId,
        submitted_by: user?.id ?? null,
        capture_type: 'inventory',
        raw_payload: { name: name.trim(), photo_url: publicUrlData.publicUrl },
      });
      if (insertError) throw insertError;

      setStep('done');
    } catch {
      showToast("Couldn't save this — try again.", { variant: 'error' });
      setStep('confirming');
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    fileRef.current = null;
    setPreview(null);
    setName('');
    setUncertain(false);
    setError(null);
    setStep('idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Identify New Item</h1>
      <p className="text-sm text-charcoal/50 mb-5">
        For something new — not a barcode or a label. Photograph it, confirm the name, and it lands in the
        Capture Inbox for review.
      </p>

      {step === 'idle' && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full py-10 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/70 hover:bg-gold-light/10 transition-colors"
          >
            🆕 Tap to photograph the item
          </button>
        </>
      )}

      {preview && step !== 'idle' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="w-full rounded-2xl mb-4 max-h-64 object-cover" />
      )}

      {step === 'identifying' && (
        <div className="text-center py-8">
          <p className="text-sm text-charcoal/60 animate-pulse font-display italic">Identifying…</p>
        </div>
      )}

      {(step === 'confirming' || step === 'saving') && (
        <div className="space-y-3">
          {error && <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2">{error}</p>}
          {!error && uncertain && (
            <p className="text-xs text-gold-dark bg-gold-light/20 rounded-xl px-3 py-2">
              Low-confidence guess — double-check before adding.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gold-dark mb-1">
              Item name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Red Onions"
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <p className="text-[11px] text-charcoal/40">
            Just the name for now — category, location, and quantity get filled in when this is reviewed in the
            Capture Inbox.
          </p>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={step === 'saving'}
              className="flex-1 py-2.5 rounded-full border border-gold-light/60 text-charcoal text-sm disabled:opacity-40"
            >
              Retake
            </button>
            <button
              onClick={handleAdd}
              disabled={step === 'saving' || !name.trim()}
              className="flex-1 py-2.5 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
            >
              {step === 'saving' ? 'Saving…' : 'Add to Capture Inbox'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-8">
          <p className="text-sm text-charcoal mb-4">
            Sent to the Capture Inbox as <span className="font-medium">"{name.trim()}"</span> for review.
          </p>
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-full bg-gold-dark text-white text-sm font-medium"
          >
            Photograph another
          </button>
        </div>
      )}
    </div>
  );
}
