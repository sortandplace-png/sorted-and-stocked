// components/FloatingScanButton.tsx
'use client';

import { useState } from 'react';
import { Scan } from 'lucide-react';
import ScanModal from '@/components/nav/ScanModal';

// Opens the exact same inventory QR/barcode flow every other "Scan" button
// in the app opens (DesktopNav, MobileBottomNav, Inventory, Recipes) — not
// a separate flow. There's no "pick Inventory/Price/Ingredient/Recipe"
// chooser anywhere in the app to route through; Price Scanner, Ingredient
// Scanner, and Recipe Scanner are a separate, unrelated tool family only
// reachable from the Tools Hub grid, never via a "Scan" button.
export default function FloatingScanButton({ propertyId }: { propertyId: string }) {
  const [showScan, setShowScan] = useState(false);

  return (
    <>
      {/* Desktop-only: MobileBottomNav already has its own persistent,
          prominent scan button built in, so a second floating one on small
          screens would be redundant and could collide with that bar. */}
      <button
        onClick={() => setShowScan(true)}
        aria-label="Scan"
        className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-center gap-1 print:hidden"
      >
        <span className="w-14 h-14 rounded-full bg-gold-dark text-white shadow-lg shadow-charcoal/20 flex items-center justify-center hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">
          <Scan size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="text-[10px] font-medium text-charcoal bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
          Scan
        </span>
      </button>

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </>
  );
}
