// components/ServiceWorkerUpdater.tsx
'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/Toast';

// next-pwa's generated service worker calls self.skipWaiting() + clients.claim()
// on every deploy, so a new SW takes over an already-open tab's network layer
// immediately -- but the JS already executing in that tab (e.g. a Shopping
// List opened before the deploy) has no way to know that happened, and keeps
// running until an actual page reload. With no prompt, that reload might not
// happen for hours (PWA tabs get left open), which is why correctly-deployed
// changes can look "missing" on a device that hasn't reloaded since.
// controllerchange fires exactly when an already-controlled page's active SW
// changes -- not on a first-ever install -- so listening for it is the
// standard way to surface a "new version" prompt instead of a silent
// auto-reload that could wipe out an in-progress edit or scan.
export default function ServiceWorkerUpdater() {
  const showToast = useToast();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let notified = false;
    const onControllerChange = () => {
      if (notified) return;
      notified = true;
      showToast('A new version of Sorted & Stocked is available.', {
        action: { label: 'Refresh', onClick: () => window.location.reload() },
        durationMs: 60000,
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [showToast]);

  return null;
}
