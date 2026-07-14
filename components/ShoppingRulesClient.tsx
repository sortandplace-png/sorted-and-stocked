// components/ShoppingRulesClient.tsx
// A real settings destination -- there was none before. Auto-restock moved
// here from Inventory verbatim (same toggle, same read-then-merge
// feature_flags write, same full explanation text), since a property-level
// rule about how the shopping list behaves belongs on its own settings
// page, not buried as a card on the Inventory item-browser.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

export default function ShoppingRulesClient({ propertyId }: { propertyId: string }) {
  const [autoRestockEnabled, setAutoRestockEnabled] = useState(false);
  const [savingAutoRestock, setSavingAutoRestock] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const showToast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (data?.feature_flags ?? {}) as Record<string, boolean>;
    setAutoRestockEnabled(!!flags.auto_restock);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleAutoRestock() {
    setSavingAutoRestock(true);
    const next = !autoRestockEnabled;
    // Read-then-merge -- feature_flags is a single jsonb column shared by
    // every flag on this property (pesach_mode, guest_taste_memory, etc.),
    // never blind-overwrite.
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (current?.feature_flags ?? {}) as Record<string, boolean>;
    const { error: flagError } = await supabase
      .from('properties')
      .update({ feature_flags: { ...flags, auto_restock: next } })
      .eq('id', propertyId);
    setSavingAutoRestock(false);
    if (flagError) {
      showToast('Failed to update auto-restock setting.', { variant: 'error' });
      return;
    }
    setAutoRestockEnabled(next);
    showToast(next ? 'Auto-restock enabled.' : 'Auto-restock disabled.', { variant: 'success' });
  }

  if (loading) return <SkeletonList rows={2} />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Shopping Rules</h1>
      <p className="text-sm text-charcoal/50 mb-4">How the shopping list behaves automatically.</p>

      <div className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gold-light/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal">Auto-restock</p>
          <p className="text-xs text-charcoal/50">
            When an item drops below its par level, add it to the shopping list automatically.
          </p>
        </div>
        <button
          onClick={toggleAutoRestock}
          disabled={savingAutoRestock}
          role="switch"
          aria-checked={autoRestockEnabled}
          aria-label="Toggle auto-restock"
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            autoRestockEnabled ? 'bg-gold-dark' : 'bg-gold-light/50'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              autoRestockEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
