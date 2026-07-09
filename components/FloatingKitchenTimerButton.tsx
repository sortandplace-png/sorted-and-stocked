'use client';

import { useState } from 'react';
import { Timer as TimerIcon, X } from 'lucide-react';
import KitchenTimerClient from '@/components/KitchenTimerClient';

// Same floating-button visual pattern/position as FloatingScanButton
// (fixed bottom-6, round icon circle + label pill), opening a compact
// popup around the existing KitchenTimerClient rather than a second,
// separate timer implementation.
export default function FloatingKitchenTimerButton() {
  const [showTimer, setShowTimer] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowTimer(true)}
        aria-label="Kitchen Timer"
        className="fixed bottom-20 left-6 md:bottom-6 z-40 flex flex-col items-center gap-1 print:hidden"
      >
        <span className="w-14 h-14 rounded-full bg-gold-dark text-white shadow-lg shadow-charcoal/20 flex items-center justify-center hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">
          <TimerIcon size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="text-[10px] font-medium text-charcoal bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
          Timer
        </span>
      </button>

      {showTimer && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setShowTimer(false)}
        >
          <div
            className="w-full sm:w-auto bg-transparent rounded-t-[2rem] sm:rounded-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTimer(false)}
              aria-label="Close"
              className="absolute -top-2 right-3 sm:-right-3 sm:top-3 w-11 h-11 flex items-center justify-center text-cream/70 hover:text-cream z-10"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
            <KitchenTimerClient />
          </div>
        </div>
      )}
    </>
  );
}
