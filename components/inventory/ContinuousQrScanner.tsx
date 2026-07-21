// components/inventory/ContinuousQrScanner.tsx
// SS-012: continuous, frame-by-frame batch QR intake. Reuses QRScanner
// (already handles the camera lifecycle safely -- pause via `active` prop
// without unmounting, matching the DOM-safety requirement here directly)
// and useScanFeedback (already used by the single-item ScanClient flow)
// rather than rebuilding either. What's actually new: the running batch
// list, the increment-on-scan write, and haptic feedback (useScanFeedback
// only ever had visual + audio, no navigator.vibrate).
'use client';

import { useCallback, useRef, useState } from 'react';
import { X, Pause, Play, Check } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useScanFeedback } from '@/lib/hooks/useScanFeedback';
import PhotoOrFallback from '@/components/PhotoOrFallback';

type BatchEntry = {
  itemId: string;
  name: string;
  photoUrl: string | null;
  scannedCount: number;
  qtyBefore: number;
  qtyAfter: number;
};

export default function ContinuousQrScanner({
  propertyId,
  open,
  onClose,
  onFinish,
}: {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  // Caller decides what "review" means (navigate to inventory, shopping
  // list, wherever) -- this component just reports that the batch is done.
  onFinish?: (batch: { itemId: string; scannedCount: number }[]) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [batch, setBatch] = useState<BatchEntry[]>([]);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  // Guards against a second scan starting its own lookup+write before the
  // first one finishes -- html5-qrcode's own per-code debounce (1.5s here)
  // stops the *same* code firing twice, but two *different* codes scanned
  // in quick succession could still overlap without this.
  const processingRef = useRef(false);
  const supabase = createClient();
  const { triggerFeedback, getFlashClass } = useScanFeedback();

  const handleScan = useCallback(
    async (code: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setNotFoundCode(null);

      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('id, name, photo_url, current_qty')
        .eq('property_id', propertyId)
        .eq('qr_code', code)
        .maybeSingle();

      if (error || !item) {
        triggerFeedback('error');
        setNotFoundCode(code);
        processingRef.current = false;
        return;
      }

      const newQty = Number(item.current_qty) + 1;
      const result = await resilientUpdate(
        supabase,
        'inventory_items',
        { id: item.id },
        { current_qty: newQty }
      );

      if (!result.ok) {
        triggerFeedback('error');
        processingRef.current = false;
        return;
      }

      triggerFeedback('success');
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);

      setBatch((prev) => {
        const existing = prev.find((b) => b.itemId === item.id);
        if (existing) {
          return prev.map((b) =>
            b.itemId === item.id ? { ...b, scannedCount: b.scannedCount + 1, qtyAfter: newQty } : b
          );
        }
        return [
          {
            itemId: item.id,
            name: item.name,
            photoUrl: item.photo_url,
            scannedCount: 1,
            qtyBefore: Number(item.current_qty),
            qtyAfter: newQty,
          },
          ...prev,
        ];
      });

      processingRef.current = false;
    },
    [propertyId, supabase, triggerFeedback]
  );

  if (!open) return null;

  const totalScans = batch.reduce((sum, b) => sum + b.scannedCount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-3">
        <span className="text-white text-sm font-medium">
          {totalScans > 0 ? `${totalScans} scanned · ${batch.length} item${batch.length === 1 ? '' : 's'}` : 'Batch Scan'}
        </span>
        <button
          onClick={onClose}
          aria-label="Close batch scanner"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 shrink-0">
        <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
          <div
            className={`absolute inset-0 z-10 pointer-events-none border-4 transition-all duration-150 ${getFlashClass()}`}
          />
          {/* Purely visual guide -- the real detection region is QRScanner's
              own internal qrbox config, this doesn't change what's scannable. */}
          <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
            <div className="w-[220px] h-[220px] max-w-[70%] max-h-[70%] border-[1.5px] border-brass rounded-2xl" />
          </div>
          <QRScanner onScan={handleScan} active={open && !paused} debounceMs={1500} />
        </div>
        {notFoundCode && (
          <p className="text-center text-rust text-xs mt-2">No item matches this code ({notFoundCode}).</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {batch.length === 0 ? (
          <p className="text-center text-white/50 text-sm mt-8">Scan an item's QR code to add it to this batch.</p>
        ) : (
          <ul className="space-y-2">
            {batch.map((b) => (
              <li key={b.itemId} className="flex items-center gap-3 bg-card rounded-xl2 p-2.5">
                <PhotoOrFallback src={b.photoUrl} sizeClass="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-denim truncate">{b.name}</p>
                  <p className="text-xs text-dusk">
                    {b.qtyBefore} → {b.qtyAfter}
                    {b.scannedCount > 1 ? ` (scanned ${b.scannedCount}×)` : ''}
                  </p>
                </div>
                <Check size={16} className="text-sage shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0">
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          {paused ? 'Resume Camera' : 'Pause Camera'}
        </button>
        <button
          onClick={() => {
            onFinish?.(batch.map((b) => ({ itemId: b.itemId, scannedCount: b.scannedCount })));
            onClose();
          }}
          className="flex-1 py-3 rounded-full bg-denim text-white text-sm font-medium"
        >
          Finish Batch & Review
        </button>
      </div>
    </div>
  );
}
