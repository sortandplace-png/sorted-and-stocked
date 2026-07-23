// lib/use-session-persisted-state.ts
// Drop-in useState replacement that survives a phone lock or app
// backgrounding. On mobile, resuming a backgrounded tab often triggers a
// full page reload (memory pressure, Safari's tab suspension) rather than
// just repainting -- that resets ordinary useState, which is what broke a
// mid-walkthrough pantry or recipe filter session. sessionStorage (not
// localStorage) is the right scope: it survives that kind of reload but
// still clears when the tab actually closes, so it doesn't linger forever
// like a real persisted preference would.
import { useEffect, useState } from 'react';

export function useSessionPersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing / storage quota -- filters just won't survive a
      // reload in that case, not worth surfacing an error over.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
