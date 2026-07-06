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

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(delta * 0.5, 100)); // damped, capped
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return;
      if (pullDistance > PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullDistance, refreshing]);

  return { pullDistance, refreshing };
}
