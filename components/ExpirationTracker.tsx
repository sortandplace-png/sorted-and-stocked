'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type RiskItem = {
  id: string;
  name: string;
  days_until_expiration: number;
  is_locked: boolean;
  location_name: string;
  property_name: string;
};

export default function ExpirationTracker({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadRiskItems = async () => {
      const { data, error } = await supabase
        .from('operational_risk_tracker')
        .select('*')
        .or(`property_name.eq.Strauss Residence`);

      if (!error && data) {
        setItems(data);
      }
      setLoading(false);
    };

    loadRiskItems();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-charcoal/50">Loading expiration data...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 bg-emerald-50/40 rounded-2xl border border-emerald-200/50">
        <p className="text-sm text-emerald-700">✅ No items nearing expiration</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="h-5 w-5 text-rust" />
        <h3 className="font-semibold text-charcoal">Items Nearing Expiration</h3>
      </div>

      {items.map((item) => {
        const isExpired = item.days_until_expiration < 0;
        const isImmediate = item.days_until_expiration <= 3;

        return (
          <div
            key={item.id}
            className={`p-4 rounded-lg border-l-4 ${
              isExpired
                ? 'bg-red-50 border-l-red-500 text-red-900'
                : isImmediate
                ? 'bg-orange-50 border-l-orange-500 text-orange-900'
                : 'bg-yellow-50 border-l-yellow-500 text-yellow-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs opacity-75 mt-1">{item.location_name}</p>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">
                  {isExpired ? '❌ EXPIRED' : `${item.days_until_expiration}d`}
                </span>
              </div>
            </div>

            {item.is_locked && (
              <p className="text-xs mt-2 opacity-75">🔒 Pesach/Holiday Lockout</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
