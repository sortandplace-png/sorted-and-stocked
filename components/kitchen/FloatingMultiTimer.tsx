// components/kitchen/FloatingMultiTimer.tsx
// SS-034: replaces FloatingKitchenTimerButton's fixed inset-0 bg-black/40
// modal, which fully blocked the page underneath -- the opposite of what
// a kitchen timer needs (start it, then keep browsing/cooking while it
// counts down in the background). Deliberate architecture choice, not a
// palette-only fix: the popup here has no backdrop and doesn't intercept
// clicks on the rest of the page, and KitchenTimerClient is ALWAYS
// mounted (never conditionally rendered on expanded/collapsed) so its own
// internal setInterval keeps running while collapsed -- only visibility
// (CSS) toggles. KitchenTimerClient's timer state stays fully
// internal/private, unchanged from its other two callers
// (/tools/kitchen-timer, KitchenOpsToolModal); the only addition there is
// an optional onTimersChange listener, used here purely to show a live
// "nearest timer" countdown on the collapsed button, not to control it.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer as TimerIcon, X } from 'lucide-react';
import KitchenTimerClient, { type Timer } from '@/components/KitchenTimerClient';

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function FloatingMultiTimer() {
  const [expanded, setExpanded] = useState(false);
  const [timers, setTimers] = useState<Timer[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setExpanded(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [expanded]);

  const activeTimers = timers.filter((t) => t.isActive && t.secondsLeft > 0);
  const nearest =
    activeTimers.length > 0 ? activeTimers.reduce((a, b) => (a.secondsLeft < b.secondsLeft ? a : b)) : null;

  return (
    <>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={nearest ? `Kitchen Timer — ${nearest.name}, ${formatTime(nearest.secondsLeft)} left` : 'Kitchen Timer'}
        aria-expanded={expanded}
        className="fixed bottom-20 left-6 md:bottom-6 z-40 flex flex-col items-center gap-1 print:hidden"
      >
        <span className="relative w-14 h-14 rounded-full bg-denim text-white shadow-lg shadow-black/20 flex items-center justify-center hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim">
          <TimerIcon size={24} strokeWidth={1.75} aria-hidden="true" />
          {activeTimers.length > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brass text-denim text-[10px] font-bold flex items-center justify-center"
              aria-hidden="true"
            >
              {activeTimers.length}
            </span>
          )}
        </span>
        <span className="text-[10px] font-medium text-denim bg-card/90 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
          {nearest ? formatTime(nearest.secondsLeft) : 'Timer'}
        </span>
      </button>

      {/* Always mounted -- `hidden` only toggles visibility, never
          unmounts KitchenTimerClient, so its countdown keeps running
          while this is collapsed. No backdrop, doesn't block the page. */}
      <div
        ref={panelRef}
        className={`fixed bottom-40 left-4 md:bottom-24 z-40 max-h-[70vh] overflow-y-auto print:hidden ${
          expanded ? 'block' : 'hidden'
        }`}
      >
        <div className="relative">
          <button
            onClick={() => setExpanded(false)}
            aria-label="Close timer panel"
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-denim text-white flex items-center justify-center shadow-md z-10"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <KitchenTimerClient onTimersChange={setTimers} />
        </div>
      </div>
    </>
  );
}
