'use client';

import React from 'react';
import { Lock, Printer, AlertCircle } from 'lucide-react';

export function ShabbosModeBanner({
  propertyName,
  isActive,
  onPrintList,
  snapshotUrl
}: {
  propertyName: string;
  isActive: boolean;
  onPrintList: () => void;
  snapshotUrl?: string;
}) {
  if (!isActive) return null;

  return (
    <div className="bg-denim text-white p-4 font-sans shadow-lg border-b-4 border-brass no-print">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brass/20 rounded-lg animate-pulse">
            <Lock className="h-5 w-5 text-brass" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">
              🕯️ Shabbos Mode Active — {propertyName}
            </h3>
            <p className="text-sm text-white/80 mt-0.5">
              Database is locked for the weekend. All changes are disabled until Sunday morning.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrintList}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-denim hover:bg-mist font-bold rounded-lg text-sm uppercase tracking-widest transition-colors shadow-md no-print"
          >
            <Printer className="h-4 w-4" />
            Print List
          </button>
        </div>
      </div>

      {/* Static Preview Info */}
      <div className="mt-3 text-xs text-white/80 text-center">
        This shopping list has been frozen. No modifications allowed until Saturday night.
      </div>
    </div>
  );
}

export function PrintableShoppingListLayout({ items, propertyName, dateGenerated }: any) {
  return (
    <div className="p-8 bg-white text-black font-serif max-w-2xl mx-auto">
      {/* Print Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">SORTED & STOCKED</h1>
        <p className="text-sm mt-1">{propertyName}</p>
        <p className="text-xs text-gray-600 mt-2">Shopping List — {dateGenerated}</p>
      </div>

      {/* Items Table */}
      <div className="space-y-4">
        {items && items.length > 0 ? (
          items.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between border-b border-gray-300 pb-2">
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.item}</p>
                <p className="text-xs text-gray-600">{item.loc}</p>
              </div>
              <div className="text-right text-sm font-mono">
                <p>{item.qty} {item.unit}</p>
              </div>
              <div className="w-8 text-center">
                <p className="text-lg">☐</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-600">No items on list</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-500 border-t-2 border-black pt-4">
        <p>Prepared for Shabbat observance</p>
        <p>Keep this list accessible during the weekend</p>
      </div>
    </div>
  );
}
