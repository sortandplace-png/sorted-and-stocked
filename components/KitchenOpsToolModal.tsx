'use client';

import { X } from 'lucide-react';
import KitchenTimerClient from '@/components/KitchenTimerClient';
import GuestScalerClient from '@/components/GuestScalerClient';
import ResetChecklistClient from '@/components/ResetChecklistClient';
import PrepTimelineClient from '@/components/PrepTimelineClient';

export type KitchenOpsSlug = 'kitchen-timer' | 'guest-scaler' | 'reset-checklist' | 'prep-timeline';

// Each of these 4 tool components already renders its own <h1> title
// internally (confirmed before building this -- e.g. GuestScalerClient's
// "Simcha Guest Scaler" h1), so this wrapper only adds a minimal close
// button, not a second header bar. Same visual pattern as the existing
// FloatingKitchenTimerButton's popup (the one already-correct precedent
// for "open this tool without navigating away"), extended to the other 3.
export default function KitchenOpsToolModal({
  slug,
  propertyId,
  onClose,
  recipeName,
  recipeMinutes,
}: {
  slug: KitchenOpsSlug;
  propertyId: string;
  onClose: () => void;
  // Only meaningful for 'kitchen-timer' -- pre-fills the add-timer form
  // when opened from a specific recipe's own approx_total_minutes. Absent
  // (Tools Hub launch) or null (recipe has no recorded time) both fall back
  // to the tool's normal blank/manual-entry behavior.
  recipeName?: string;
  recipeMinutes?: number | null;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-[2rem] sm:rounded-2xl max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-dusk hover:text-denim z-10"
        >
          <X size={20} strokeWidth={1.75} />
        </button>
        {slug === 'kitchen-timer' && (
          <KitchenTimerClient initialName={recipeName} initialMinutes={recipeMinutes} />
        )}
        {slug === 'guest-scaler' && <GuestScalerClient propertyId={propertyId} />}
        {slug === 'reset-checklist' && <ResetChecklistClient propertyId={propertyId} />}
        {slug === 'prep-timeline' && <PrepTimelineClient propertyId={propertyId} />}
      </div>
    </div>
  );
}
