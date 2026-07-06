// components/OfflineSyncProvider.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { registerOfflineSync, flushQueue } from '@/lib/offline-queue';

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    registerOfflineSync(supabase); // flushes now + on every 'online' event

    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      flushQueue(supabase);
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // "Remember me" enforcement: if the person unchecked it at login, sign
    // out automatically when this tab actually closes, rather than staying
    // signed in indefinitely. Session-only flag, so it only applies to the
    // browser session it was set in — a fresh sign-in resets the choice.
    const handleUnload = () => {
      if (sessionStorage.getItem('sortedandstocked_no_remember') === '1') {
        // Best-effort — browsers don't guarantee async work completes during
        // unload, but Supabase's signOut clears local storage synchronously
        // enough in practice for this purpose.
        supabase.auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs text-center py-1 sticky top-0 z-50">
          Offline — changes will sync when connection returns
        </div>
      )}
      {children}
    </>
  );
}
