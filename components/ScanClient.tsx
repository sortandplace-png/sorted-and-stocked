// components/ScanClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, Flashlight, PackagePlus, Search } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import Pin from '@/components/PinAccent';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { useScanFeedback } from '@/lib/hooks/useScanFeedback';
import RestockPhotoPrompt from '@/components/RestockPhotoPrompt';
import { getPreferredSource, type ReorderSource } from '@/lib/reorder-sources';
import ReorderSourcePills from '@/components/ReorderSourcePills';

type ScannedItem = {
  id: string;
  name: string;
  current_qty: number;
  min_qty: number;
  unit: string;
  unit_cost: number | null;
  photo_url: string | null;
  reorder_link: string | null;
  reorder_sources: ReorderSource[] | null;
};

type LookupState =
  | { status: 'scanning' }
  | { status: 'checking' }
  | { status: 'not-found'; code: string }
  | { status: 'item-found'; item: ScannedItem }
  | { status: 'error'; message: string };

export default function ScanClient({
  propertyId,
  initialCode,
}: {
  propertyId: string;
  initialCode?: string;
}) {
  const [state, setState] = useState<LookupState>({ status: 'scanning' });
  const [adjustedQty, setAdjustedQty] = useState('');
  const [adjustedPrice, setAdjustedPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoPromptItem, setPhotoPromptItem] = useState<{ id: string; name: string } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const showToast = useToast();
  const t = useTranslations('scan');
  const { triggerFeedback, getFlashClass } = useScanFeedback();

  const handleScan = useCallback(
    async (code: string) => {
      setState({ status: 'checking' });

      // Locations first — scanning a bin/shelf label is the more common
      // action (checking what's in an area), items second.
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('property_id', propertyId)
        .eq('qr_code', code)
        .maybeSingle();

      if (locationError) {
        triggerFeedback('error');
        setState({ status: 'error', message: locationError.message });
        return;
      }

      if (location) {
        triggerFeedback('success');
        setState({ status: 'scanning' });
        router.push(`/properties/${propertyId}/inventory?location=${location.id}`);
        return;
      }

      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('id, name, current_qty, min_qty, unit, unit_cost, photo_url, reorder_link, reorder_sources(id, retailer_name, url, is_preferred)')
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
        setAdjustedPrice(item.unit_cost !== null ? String(item.unit_cost) : '');
        setState({ status: 'item-found', item });
        return;
      }

      triggerFeedback('error');
      setState({ status: 'not-found', code });
    },
    [propertyId, router, supabase, triggerFeedback]
  );

  // Registers this scanned code as a brand-new item's qr_code, not a freshly
  // generated one -- goes straight to the table instead of
  // create_inventory_item_with_source, since that RPC's own INSERT column
  // list omits qr_code entirely (confirmed against its definition) and would
  // just fall through to the auto-generate trigger. The trigger itself
  // (generate_item_qr_code) only fills qr_code in when it's null, so handing
  // it a real value here is respected as-is. qr_code has a table-wide unique
  // constraint (not property-scoped), while the not-found state above is
  // reached via a property-scoped lookup -- so a code already claimed by a
  // different property is a real, reachable case here, not a hypothetical.
  async function addNewItem() {
    const name = newItemName.trim();
    if (!name || state.status !== 'not-found') return;
    setAddingItem(true);

    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('qr_code', state.code)
        .maybeSingle();
      if (existing) {
        setAddingItem(false);
        showToast('This code is already assigned to an item at a different property.', { variant: 'error' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const result = await resilientInsert(supabase, 'inventory_items', {
      id,
      property_id: propertyId,
      name,
      qr_code: state.code,
    });
    setAddingItem(false);
    if (!result.ok) {
      showToast(
        /qr_code/i.test(result.error)
          ? 'This code is already assigned to an item at a different property.'
          : 'Failed to add item.',
        { variant: 'error' }
      );
      return;
    }

    triggerFeedback('success');
    setNewItemName('');
    setAdjustedQty('0');
    setAdjustedPrice('');
    setState({
      status: 'item-found',
      item: {
        id,
        name,
        current_qty: 0,
        min_qty: 0,
        unit: 'pcs',
        unit_cost: null,
        photo_url: null,
        reorder_link: null,
        reorder_sources: null,
      },
    });
    showToast(result.queued ? 'Added — will sync when back online.' : 'Item added.', { variant: 'success' });
  }

  // Deep-link entry point: a physical label's QR encodes a URL (see
  // app/scan/[code]/page.tsx) that lands here with ?code=..., so a scan from
  // a plain camera app resolves the item the same way an in-app scan would.
  useEffect(() => {
    if (initialCode) handleScan(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function saveQty() {
    if (state.status !== 'item-found') return;
    setSaving(true);
    // Price is optional and manual, same as the main inventory edit form —
    // an empty field means "leave unset," not "set to 0".
    const result = await resilientUpdate(
      supabase,
      'inventory_items',
      { id: state.item.id },
      {
        current_qty: Number(adjustedQty) || 0,
        unit_cost: adjustedPrice.trim() ? Number(adjustedPrice) : null,
      }
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
    // Photo upload has no offline queue of its own (unlike the qty write
    // above) — skip the prompt entirely when offline rather than let
    // someone tap "Save photo" into a guaranteed failure.
    if (!result.queued && !state.item.photo_url) {
      setPhotoPromptItem({ id: state.item.id, name: state.item.name });
    } else {
      setState({ status: 'scanning' });
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-mist min-h-screen">
      <h1 className="font-display text-2xl text-denim mb-4">Scan a label</h1>

      {(state.status === 'scanning' || state.status === 'checking') && (
        <div className="relative bg-card border border-cardBorder rounded-xl2 shadow-card overflow-hidden">
          <Pin size="lg" />
          <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
            Price &amp; Label Scanner
          </div>
          <div className="p-6">
            <div className="relative overflow-hidden rounded-xl">
              <div className={`absolute inset-0 z-10 pointer-events-none border-4 transition-all duration-150 ${getFlashClass()}`} />
              <QRScanner onScan={handleScan} active={state.status === 'scanning'} torchOn={torchOn} />
            </div>
            {state.status === 'checking' && (
              <p className="text-sm text-dusk text-center mt-3">Looking that up…</p>
            )}
            <p className="text-xs text-dusk text-center mt-3">Align barcode or QR code within frame</p>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setTorchOn((v) => !v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  torchOn ? 'bg-brass text-denim' : 'bg-mist text-denim border border-cardBorder'
                }`}
              >
                <Flashlight size={16} strokeWidth={1.75} aria-hidden="true" /> Flashlight
              </button>
              <button
                type="button"
                onClick={() => setManualSearchOpen((v) => !v)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium bg-denim text-white"
              >
                <Search size={16} strokeWidth={1.75} aria-hidden="true" /> Manual Search
              </button>
            </div>

            {manualSearchOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) handleScan(manualCode.trim());
                }}
                className="flex gap-2 mt-3"
              >
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter code"
                  autoFocus
                  className="flex-1 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2 bg-mist text-sm text-denim"
                />
                <button type="submit" className="px-5 rounded-full bg-brass text-denim text-sm font-medium">
                  Go
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {state.status === 'not-found' && (
        <div className="relative bg-card border border-cardBorder rounded-xl2 shadow-card p-5 mt-6 text-center">
          <Pin size="sm" />
          <p className="text-sm text-denim mb-1">No location or item matches this code.</p>
          <p className="text-xs text-dusk font-mono mb-4">{state.code}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addNewItem();
            }}
            className="flex gap-2 mb-3"
          >
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="New item name"
              className="flex-1 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2 bg-mist text-sm text-denim"
            />
            <button
              type="submit"
              disabled={addingItem || !newItemName.trim()}
              className="shrink-0 flex items-center gap-1.5 px-4 rounded-full bg-brass text-denim text-sm font-medium disabled:opacity-40"
            >
              <PackagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
              {addingItem ? 'Adding…' : 'Add as new item'}
            </button>
          </form>

          <button
            onClick={() => setState({ status: 'scanning' })}
            className="py-2.5 px-5 rounded-full bg-denim text-white text-sm"
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
            className="py-2.5 px-5 rounded-full bg-charcoal text-cream text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'item-found' && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-5">
          {state.item.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.item.photo_url}
              alt=""
              className="w-full h-40 object-cover rounded-xl border border-gold-light/40 mb-3"
            />
          )}
          <p className="font-display text-lg text-charcoal mb-1">{state.item.name}</p>
          <p className="text-xs text-charcoal/40 mb-3">
            Min stock: {state.item.min_qty} {state.item.unit}
          </p>
          {(state.item.reorder_sources?.length ?? 0) > 1 ? (
            <ReorderSourcePills sources={state.item.reorder_sources!} className="justify-center mb-3" />
          ) : (
            getPreferredSource(state.item.reorder_sources) && (
              <a
                href={getPreferredSource(state.item.reorder_sources)!.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full border border-gold text-gold-dark text-sm font-medium mb-3"
              >
                <ExternalLink size={14} strokeWidth={1.75} /> {t('reorder')}
              </a>
            )
          )}
          <label className="text-sm text-charcoal/60 block mb-1">Current quantity</label>
          <input
            type="number"
            value={adjustedQty}
            onChange={(e) => setAdjustedQty(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 mb-3 bg-cream/40"
            autoFocus
          />
          <label className="text-sm text-charcoal/60 block mb-1">Price ($, optional)</label>
          <input
            type="number"
            step="0.01"
            value={adjustedPrice}
            onChange={(e) => setAdjustedPrice(e.target.value)}
            placeholder="—"
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-2.5 mb-3 bg-cream/40"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setState({ status: 'scanning' })}
              className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
            >
              Cancel
            </button>
            <button
              onClick={saveQty}
              disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {photoPromptItem && (
        <RestockPhotoPrompt
          itemId={photoPromptItem.id}
          itemName={photoPromptItem.name}
          propertyId={propertyId}
          onDone={() => {
            setPhotoPromptItem(null);
            setState({ status: 'scanning' });
          }}
        />
      )}
    </div>
  );
}
