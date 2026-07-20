// components/PhotoToolClient.tsx
'use client';

import { useRef, useState } from 'react';
import { compressImageToDataUrl } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';

type PhotoToolClientProps = {
  propertyId: string;
  title: string;
  description: string;
  apiRoute: string;
  actionLabel: string;
  textPlaceholder: string;
};

// Downscaling here also shrinks the payload sent to the vision API — a raw
// 12MP phone photo adds real latency and cost for no analysis benefit.
async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await compressImageToDataUrl(file, { maxDimension: 1200 });
  const base64 = dataUrl.replace(/^data:[^,]*,/, '');
  return { data: base64, mediaType: 'image/jpeg' };
}

export default function PhotoToolClient({
  propertyId,
  title,
  description,
  apiRoute,
  actionLabel,
  textPlaceholder,
}: PhotoToolClientProps) {
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [preview, setPreview] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  async function runAnalysis(payload: Record<string, unknown>) {
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, ...payload }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong.');
        showToast('Failed to analyze.', { variant: 'error' });
        return;
      }
      setResult(body.result);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    // Previously unguarded -- a decode failure here (corrupt file, an
    // unsupported format like HEIC in some browsers, no canvas 2d context)
    // threw inside an event handler with no catch anywhere in the call
    // chain. That's a silent, uncaught promise rejection: the UI shows the
    // preview image, then just sits there forever with no loading state,
    // no error, and runAnalysis() -- which holds the actual fetch() call --
    // never runs at all. Indistinguishable from "does nothing" to whoever's
    // using it.
    try {
      const { data, mediaType } = await fileToBase64(file);
      runAnalysis({ imageBase64: data, mediaType });
    } catch {
      setError("Couldn't read that photo — try a different one.");
    }
  }

  function handleTextSubmit() {
    if (!textInput.trim()) return;
    runAnalysis({ textInput: textInput.trim() });
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setTextInput('');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const hasInput = !!preview || !!result;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">{title}</h1>
      <p className="text-sm text-charcoal/50 mb-4">{description}</p>

      {!hasInput && (
        <>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setMode('photo')}
              className={
                mode === 'photo'
                  ? 'flex-1 py-2 rounded-full bg-charcoal text-cream text-sm'
                  : 'flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-sm'
              }
            >
              📷 Photo
            </button>
            <button
              onClick={() => setMode('text')}
              className={
                mode === 'text'
                  ? 'flex-1 py-2 rounded-full bg-charcoal text-cream text-sm'
                  : 'flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-sm'
              }
            >
              ⌨️ Type it in
            </button>
          </div>

          {mode === 'photo' ? (
            // Two real inputs, not one relying on `capture` as a hint --
            // confirmed live that some mobile browsers open the gallery
            // picker regardless of capture="environment" being set, so a
            // single input can't reliably guarantee the camera path.
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gold-light rounded-2xl py-10 text-center bg-white/50"
              >
                <span className="text-4xl block mb-2">📷</span>
                <span className="text-sm text-charcoal font-medium">{actionLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="border-2 border-dashed border-gold-light rounded-2xl py-10 text-center bg-white/50"
              >
                <span className="text-4xl block mb-2">🖼️</span>
                <span className="text-sm text-charcoal font-medium">Choose from library</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={textPlaceholder}
                rows={3}
                className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-3 bg-white"
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="w-full mt-3 py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
              >
                Analyze
              </button>
            </div>
          )}
        </>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Uploaded" className="w-full rounded-2xl mb-4 max-h-64 object-cover" />
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-sm text-charcoal/60 animate-pulse font-display italic">Analyzing…</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      {result && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-5 whitespace-pre-wrap text-sm leading-relaxed text-charcoal">
          {result}
        </div>
      )}

      {(preview || result) && !loading && (
        <button
          onClick={reset}
          className="w-full mt-4 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal text-sm font-medium"
        >
          Try another
        </button>
      )}
    </div>
  );
}
