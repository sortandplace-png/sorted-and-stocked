'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type MetricCard = {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
};

export default function AnalyticsDashboard({ propertyId }: { propertyId: string }) {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [spending, setSpending] = useState<{ category: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadMetrics = async () => {
      // Load spending by category
      const { data: budgetData } = await supabase.rpc(
        'project_property_budget',
        { target_property_id: propertyId }
      );

      if (budgetData) {
        setSpending(budgetData.map((item: any) => ({
          category: item.category_name,
          amount: parseFloat(item.estimated_cost) || 0
        })));
      }

      // Load inventory metrics
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('id, current_qty, min_qty')
        .eq('property_id', propertyId);

      const lowStockCount = inventoryData?.filter(
        (i: any) => i.current_qty < i.min_qty
      ).length || 0;

      const mealMetrics: MetricCard[] = [
        {
          label: 'Active Inventory Items',
          value: inventoryData?.length || 0,
          icon: <ShoppingCart className="h-5 w-5 text-charcoal" />
        },
        {
          label: 'Items Below Minimum',
          value: lowStockCount,
          trend: lowStockCount > 0 ? -1 : 0,
          icon: <TrendingUp className="h-5 w-5 text-rust" />
        },
        {
          label: 'Replenishment Budget',
          value: spending.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
          icon: <BarChart3 className="h-5 w-5 text-gold-dark" />
        }
      ];

      setMetrics(mealMetrics);
      setLoading(false);
    };

    loadMetrics();
  }, [propertyId]);

  if (loading) {
    return <div className="text-center py-12 text-charcoal/50">Loading analytics...</div>;
  }

  const totalSpending = spending.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-6 w-6 text-charcoal" />
        <h2 className="text-2xl font-display text-charcoal">Operations Analytics</h2>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-6 border border-gold-light/20 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-charcoal/60 mb-2">{metric.label}</p>
                <p className="text-3xl font-bold text-charcoal">{metric.value}</p>
                {metric.trend !== undefined && metric.trend < 0 && (
                  <p className="text-xs text-rust mt-2">⚠️ Action needed</p>
                )}
              </div>
              <div className="text-charcoal opacity-50">{metric.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Spending by Category */}
      {spending.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gold-light/20 shadow-sm">
          <h3 className="font-semibold text-charcoal mb-4">Projected Spending by Category</h3>

          <div className="space-y-3">
            {spending.map((item) => {
              const percentage = (item.amount / totalSpending) * 100;
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-charcoal">{item.category}</p>
                    <p className="text-sm font-bold text-charcoal">${item.amount.toFixed(2)}</p>
                  </div>
                  <div className="w-full bg-gold-light/20 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-charcoal h-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gold-light/20">
            <p className="text-sm text-charcoal/60">
              Total Projected Cost: <span className="font-bold text-charcoal">${totalSpending.toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="bg-blue-50/30 rounded-2xl p-4 border border-blue-200/30">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Insights</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Monitor categories over $50 projected cost for negotiation opportunities</li>
          <li>• Shabbos prep mode activates Friday 2:00 PM — plan shopping accordingly</li>
          <li>• Cross-reference multi-store pricing to optimize vendor selection</li>
        </ul>
      </div>
    </div>
  );
}
