// components/ScanClient.tsx
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRScanner from '@/components/QRScanner';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { useScanFeedback } from '@/lib/hooks/useScanFeedback';

type ScannedItem = {
  id: string;
  name: string;
  current_qty: number;
  min_qty: number;
  unit: string;
};

type LookupState =
  | { status: 'scanning' }
  | { status: 'checking' }
  | { status: 'not-found'; code: string }
  | { status: 'item-found'; item: ScannedItem }
  | { status: 'error'; message: string };

export default function ScanClient({ propertyId }: { propertyId: string }) {
  const [state, setState] = useState<LookupState>({ status: 'scanning' });
  const [adjustedQty, setAdjustedQty] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const showToast = useToast();
  const { triggerFeedback, getFlashClass } = useScanFeedback();

  const handleScan = useCallback(
    async (code: string) => {
      setState({ status: 'checking' });

      // Locations first — scanning a bin/shelf label is the more common
      // action (checking what's in an area), items second.
      const { data: location } = await supabase
        .from('locations')
        .select('id')
        .eq('property_id', propertyId)
        .eq('qr_code', code)
        .maybeSingle();

      if (location) {
        triggerFeedback('success');
        router.push(`/properties/${propertyId}/inventory?location=${location.id}`);
        return;
      }

      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('id, name, current_qty, min_qty, unit')
        .eq('property_id', propertyId)
        .eq('qr_code', code)
        .maybeSingle();

      if (error) {
        triggerFeedback('error');
        setState({ status: 'error', message: error.message });
        return;
      }

      if (item) {
        triggerFeedback('success');
        setAdjustedQty(String(item.current_qty));
        setState({ status: 'item-found', item });
        return;
      }

      triggerFeedback('error');
      setState({ status: 'not-found', code });
    },
    [propertyId, router, supabase, triggerFeedback]
  );

  async function saveQty() {
    if (state.status !== 'item-found') return;
    setSaving(true);
    const result = await resilientUpdate(
      supabase,
      'inventory_items',
      { id: state.item.id },
      { current_qty: Number(adjustedQty) || 0 }
    );
    setSaving(false);
    if (!result.ok) {
      setState({ status: 'error', message: result.error });
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Quantity updated.', {
      variant: 'success',
    });
    setState({ status: 'scanning' });
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-aubergine mb-3">Scan a label</h1>

      {(state.status === 'scanning' || state.status === 'checking') && (
        <>
          <div className="relative overflow-hidden rounded-xl">
            <div className={`absolute inset-0 z-10 pointer-events-none border-4 transition-all duration-150 ${getFlashClass()}`} />
            <QRScanner onScan={handleScan} active={state.status === 'scanning'} />
          </div>
          {state.status === 'checking' && (
            <p className="text-sm text-ink/50 text-center mt-3">Looking that up…</p>
          )}
        </>
      )}

      {state.status === 'not-found' && (
        <div className="text-center mt-6">
          <p className="text-sm text-ink/60 mb-1">
            No location or item matches this code.
          </p>
          <p className="text-xs text-ink/40 font-mono mb-4">{state.code}</p>
          <button
            onClick={() => setState({ status: 'scanning' })}
            className="py-2.5 px-5 rounded-full bg-aubergine text-cream text-sm"
          >
            Scan again
          </button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="text-center mt-6">
          <p className="text-sm text-rust mb-4">{state.message}</p>
          <button
            onClick={() => setState({ status: 'scanning' })}
            className="py-2.5 px-5 rounded-full bg-aubergine text-cream text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'item-found' && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-5">
          <p className="font-display text-lg text-aubergine mb-1">{state.item.name}</p>
          <p className="text-xs text-ink/40 mb-3">
            Min stock: {state.item.min_qty} {state.item.unit}
          </p>
          <label className="text-sm text-ink/60 block mb-1">Current quantity</label>
          <input
            type="number"
            value={adjustedQty}
            onChange={(e) => setAdjustedQty(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 mb-3 bg-cream/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setState({ status: 'scanning' })}
              className="flex-1 py-2.5 rounded-full border border-aubergine/30 text-aubergine"
            >
              Cancel
            </button>
            <button
              onClick={saveQty}
              disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-aubergine text-cream disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
