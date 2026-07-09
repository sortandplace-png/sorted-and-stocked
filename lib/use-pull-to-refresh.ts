// lib/use-pull-to-refresh.ts
import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 70; // px of drag before a release triggers refresh

// Attaches to window touch events. Only activates the pull gesture when the
// page is scrolled to the very top — otherwise a normal scroll-up gesture
// would fight with it, which is the #1 way homemade pull-to-refresh
// implementations end up feeling broken.
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  // Touch handlers read/write these instead of the state above, so the
  // effect below can mount its 3 window listeners once and never re-run —
  // it used to have [pullDistance, refreshing] as deps, which meant every
  // single pixel of drag movement tore down and rebuilt all 3 listeners.
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        const next = Math.min(delta * 0.5, 100); // damped, capped
        pullDistanceRef.current = next;
        setPullDistance(next);
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return;
      if (pullDistanceRef.current > PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        await onRefreshRef.current();
        refreshingRef.current = false;
        setRefreshing(false);
      }
      pullDistanceRef.current = 0;
      setPullDistance(0);
      startY.current = null;
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return { pullDistance, refreshing };
}
