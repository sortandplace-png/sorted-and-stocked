// components/nav/ScanModal.tsx
// Scan is a quick action, not a page — this wraps the existing ScanClient
// logic (unchanged) in a modal shell instead of navigating to /scan. The
// standalone /scan route still works too (direct links, bookmarks); this is
// just an additional entry point from the nav.
'use client';

import { X } from 'lucide-react';
import ScanClient from '@/components/ScanClient';

export default function ScanModal({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-[70] sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-linen w-full rounded-t-[2rem] sm:rounded-3xl max-w-md mx-auto max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-dusk hover:text-denim"
          aria-label="Close scan"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
        <ScanClient propertyId={propertyId} />
      </div>
    </div>
  );
}
