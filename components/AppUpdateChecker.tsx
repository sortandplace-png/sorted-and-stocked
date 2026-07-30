// components/AppUpdateChecker.tsx
// Formerly ServiceWorkerUpdater -- renamed because SS-339 broadened what
// this actually detects. Two independent signals, one prompt:
//
// 1. Service worker controllerchange. next-pwa's generated SW calls
//    self.skipWaiting() + clients.claim() on every deploy, so a new SW
//    takes over an already-open tab's network layer immediately -- but the
//    JS already executing in that tab has no way to know that happened.
//    controllerchange fires exactly when an already-controlled page's
//    active SW changes (not on a first-ever install), which is the
//    standard way to detect this instead of a silent auto-reload that
//    could wipe out an in-progress edit or scan.
//
// 2. Build-ID mismatch (SS-339). controllerchange only fires once a new SW
//    has actually installed, which browsers otherwise only check for
//    opportunistically -- on navigation, and roughly once every 24h
//    otherwise. Tonight's real incidents (white screen, black training
//    videos, missing SOP posters, a stale property label -- all traced to
//    production being current and individual devices holding a stale
//    browser-cached response) were NOT service-worker staleness at all, so
//    a SW-only check would have missed every one of them. Comparing the
//    app-build-id <meta> tag THIS PAGE actually loaded with (baked in by
//    app/layout.tsx at build time -- App Router has no client-readable
//    equivalent of Pages Router's window.__NEXT_DATA__.buildId) against
//    /api/build-id (always read fresh, never cached) catches staleness
//    regardless of which caching layer -- SW, HTTP cache, or a CDN -- is
//    actually holding the old response.
//
// Both signals feed the same toast, deduped by the same `notified` flag,
// so a device hitting both at once (plausible -- an old SW often implies
// an old page too) still only sees one prompt. Checked on an interval and
// on visibilitychange (a housekeeper switching back from their phone's
// home screen, or signing in mid-shift on an already-open tab) rather than
// only passively, so staleness is caught within minutes of a deploy
// instead of within a day -- staff have no reason to know "hard refresh"
// is the fix, and will report the app as broken instead.
'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function AppUpdateChecker() {
  const showToast = useToast();
  const notifiedRef = useRef(false);

  useEffect(() => {
    const notify = () => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      showToast('A new version of Sorted & Stocked is available.', {
        action: { label: 'Refresh', onClick: () => window.location.reload() },
        durationMs: 60000,
      });
    };

    // --- Signal 1: service worker takeover ---
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', notify);
    }

    let swRegistration: ServiceWorkerRegistration | null = null;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((r) => {
        swRegistration = r ?? null;
      });
    }

    // --- Signal 2: build-ID mismatch ---
    const loadedBuildId = document.querySelector('meta[name="app-build-id"]')?.getAttribute('content') ?? null;

    const check = async () => {
      swRegistration?.update().catch(() => {});

      // 'development' never mismatches itself -- see app/api/build-id's own
      // fallback -- and a missing loadedBuildId means this isn't a real
      // Next.js page (shouldn't happen, but skip rather than guess).
      if (!loadedBuildId || loadedBuildId === 'development') return;
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' });
        const { buildId } = await res.json();
        if (buildId && buildId !== loadedBuildId) notify();
      } catch {
        // Offline, or the request failed -- not evidence of staleness,
        // just skip this round rather than false-alarm.
      }
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', notify);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [showToast]);

  return null;
}
