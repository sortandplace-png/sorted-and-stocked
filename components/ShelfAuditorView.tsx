'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Sparkles, AlertCircle } from 'lucide-react';
import { useShelfAuditor } from '@/hooks/useShelfAuditor';

export default function ShelfAuditorView({
  locationId,
  propertyId,
  onComplete
}: {
  locationId: string;
  propertyId: string;
  onComplete: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = require('@/lib/supabase/client').createClient();

  useEffect(() => {
    // Load items for this location
    const loadItems = async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, category_id, current_qty, min_qty, unit, categories(name)')
        .eq('property_id', propertyId)
        .eq('location_id', locationId)
        .order('name');

      if (!error) {
        setItems(data.map((item: any) => ({
          ...item,
          category_name: item.categories?.name || 'Uncategorized'
        })));
      }
      setLoading(false);
    };

    loadItems();
  }, [locationId, propertyId]);

  const { activeItem, progressText, percentComplete, confirmStock, flagEmpty } =
    useShelfAuditor(items, onComplete);

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Loading shelf items...</div>;
  }

  if (!activeItem) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl max-w-md mx-auto shadow-md border">
        <Sparkles className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-ink">Audit Complete! ✨</h3>
        <p className="text-sm text-ink/50 mt-2">All items in this location verified.</p>
        <button
          onClick={onComplete}
          className="mt-4 px-6 py-2 rounded-full bg-aubergine text-cream text-sm font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Progress Header */}
      <div className="flex justify-between items-center text-xs font-bold text-ink/60 uppercase tracking-widest mb-2">
        <span>Shelf Audit Progress</span>
        <span>{progressText}</span>
      </div>
      <div className="w-full bg-gold-light/20 h-2 rounded-full overflow-hidden mb-6">
        <div className="bg-aubergine h-full transition-all duration-300" style={{ width: `${percentComplete}%` }} />
      </div>

      {/* Main Focus Card */}
      <div className="bg-white border-2 border-gold-light/30 rounded-3xl p-6 shadow-lg text-center flex flex-col items-center justify-between min-h-[360px]">
        <div>
          <span className="text-xs font-bold bg-gold-light/30 text-aubergine px-3 py-1 rounded-full uppercase">
            {activeItem.category_name}
          </span>
          <h2 className="text-2xl font-bold text-ink mt-4 px-2">{activeItem.name}</h2>
          <p className="text-sm text-ink/60 mt-2">
            Expected: <strong className="text-ink/90">{activeItem.min_qty} {activeItem.unit || 'units'}</strong>
          </p>
          <p className="text-xs text-ink/40 mt-1">Currently: {activeItem.current_qty}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full mt-8">
          <button
            onClick={flagEmpty}
            className="flex flex-col items-center justify-center py-4 px-6 bg-red-50/80 hover:bg-red-100 text-red-600 border-2 border-red-200 rounded-2xl active:scale-95 transition-all"
          >
            <X className="h-8 w-8 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Out / Low</span>
          </button>

          <button
            onClick={confirmStock}
            className="flex flex-col items-center justify-center py-4 px-6 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-600 border-2 border-emerald-200 rounded-2xl active:scale-95 transition-all"
          >
            <Check className="h-8 w-8 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider">Looks Good</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-ink/40 text-center mt-4">
        Tap left if empty or low. Tap right if stock is normal.
      </p>
    </div>
  );
}
