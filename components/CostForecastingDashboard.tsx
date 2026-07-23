'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type BudgetProjection = {
  category_name: string;
  depleted_count: number;
  estimated_cost: number;
};

export default function CostForecastingDashboard({ propertyId }: { propertyId: string }) {
  const [projections, setProjections] = useState<BudgetProjection[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadProjections = async () => {
      const { data, error } = await supabase.rpc(
        'project_property_budget',
        { target_property_id: propertyId }
      );

      if (!error && data) {
        setProjections(data);
        const total = data.reduce((sum: number, item: BudgetProjection) =>
          sum + (item.estimated_cost || 0), 0
        );
        setTotalCost(total);
      }
      setLoading(false);
    };

    loadProjections();
  }, [propertyId]);

  if (loading) {
    return <div className="text-center py-8 text-dusk">Calculating budget...</div>;
  }

  if (projections.length === 0) {
    return (
      <div className="text-center py-8 bg-emerald-50/40 rounded-2xl border border-emerald-200/50">
        <p className="text-sm text-emerald-700">✅ All stock levels at optimal levels</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-denim" />
        <h3 className="font-semibold text-denim">Replenishment Budget Forecast</h3>
      </div>

      {/* Total Cost Card */}
      <div className="bg-gradient-to-br from-denim/10 to-brass/10 border border-denim/20 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-dusk mb-1">Total Projected Cost</p>
            <p className="text-3xl font-bold text-denim">${totalCost.toFixed(2)}</p>
          </div>
          <TrendingUp className="h-8 w-8 text-brass opacity-60" />
        </div>
        <p className="text-xs text-dusk mt-2">To restore all items to minimum levels</p>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-2">
        {projections.map((projection) => (
          <div
            key={projection.category_name}
            className="p-4 bg-white rounded-xl border border-cardBorder hover:border-cardBorder transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-denim">{projection.category_name}</p>
                <p className="text-xs text-dusk mt-0.5">
                  {projection.depleted_count} item{projection.depleted_count !== 1 ? 's' : ''} low
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-denim">${projection.estimated_cost?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-dusk text-center pt-2">
        Based on average unit costs. Update item prices for accuracy.
      </p>
    </div>
  );
}
