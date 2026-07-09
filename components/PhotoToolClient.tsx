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
  const [, base64] = dataUrl.split(',');
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
    setPreview(URL.createObjectURL(file));
    const { data, mediaType } = await fileToBase64(file);
    runAnalysis({ imageBase64: data, mediaType });
  }

  function handleTextSubmit() {
    if (!textInput.trim()) return;
    runAnalysis({ textInput: textInput.trim() });
  }

  function reset() {
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
                  : 'flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm'
              }
            >
              📷 Photo
            </button>
            <button
              onClick={() => setMode('text')}
              className={
                mode === 'text'
                  ? 'flex-1 py-2 rounded-full bg-charcoal text-cream text-sm'
                  : 'flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm'
              }
            >
              ⌨️ Type it in
            </button>
          </div>

          {mode === 'photo' ? (
            <label className="block border-2 border-dashed border-gold-light rounded-2xl py-10 text-center cursor-pointer bg-white/50">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <span className="text-4xl block mb-2">📷</span>
              <span className="text-sm text-charcoal font-medium">{actionLabel}</span>
            </label>
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
          className="w-full mt-4 py-2.5 rounded-full border border-charcoal/30 text-charcoal text-sm font-medium"
        >
          Try another
        </button>
      )}
    </div>
  );
}
