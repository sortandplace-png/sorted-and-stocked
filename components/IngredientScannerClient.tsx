// components/IngredientScannerClient.tsx
'use client';

import { useRef, useState } from 'react';
import { compressImageToDataUrl } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';

type ScannerResult = {
  productName: string | null;
  allergens: string[];
  kosherGuess: string | null;
  analysis: string;
};

// Same downscaling rationale as PhotoToolClient — smaller payload, less
// vision-call latency and cost, no real analysis benefit lost.
async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await compressImageToDataUrl(file, { maxDimension: 1200 });
  const base64 = dataUrl.replace(/^data:[^,]*,/, '');
  return { data: base64, mediaType: 'image/jpeg' };
}

export default function IngredientScannerClient({ propertyId }: { propertyId: string }) {
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [preview, setPreview] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  async function runAnalysis(payload: Record<string, unknown>) {
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tools/ingredient-scanner', {
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
      setResult(body);
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
    const { data, mediaType } = await fileToBase64(file);
    runAnalysis({ imageBase64: data, mediaType });
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
      <h1 className="text-2xl font-display text-charcoal mb-1">Ingredient Scanner</h1>
      <p className="text-sm text-charcoal/50 mb-4">Photograph or type in a label for a plain-language, evidence-based read.</p>

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
            // picker regardless of capture="environment" being set.
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gold-light rounded-2xl py-10 text-center bg-white/50"
              >
                <span className="text-4xl block mb-2">📷</span>
                <span className="text-sm text-charcoal font-medium">Take a photo of a label</span>
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
                placeholder="e.g. Water, Sugar, Citric Acid, Sodium Benzoate..."
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
        <div className="space-y-3">
          {result.productName && (
            <h2 className="font-display text-lg text-charcoal">{result.productName}</h2>
          )}

          {result.allergens.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">Allergens</p>
              <div className="flex flex-wrap gap-1.5">
                {result.allergens.map((a) => (
                  <span key={a} className="text-xs font-medium bg-rust/10 text-rust px-2.5 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fixed disclaimer, not model output — guarantees the caution
              language always renders exactly as intended and can't be
              omitted or softened by however the model phrases its guess. */}
          {result.kosherGuess && (
            <div className="bg-rust/10 rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-rust mb-1.5">
                ⚠️ AI estimate, not a hechsher — verify the actual package
              </p>
              <p className="text-sm text-charcoal">{result.kosherGuess}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-5 whitespace-pre-wrap text-sm leading-relaxed text-charcoal">
            {result.analysis}
          </div>
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
