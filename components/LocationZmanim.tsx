// components/LocationZmanim.tsx
// Opt-in "use my location" toggle next to the Home dashboard's fixed
// household candle-lighting time. Never automatic -- starts on the
// household default on every page load, only switches on an explicit tap.
// Coordinates from the browser's Geolocation API are used for exactly one
// fetch to /api/zmanim and held only in this component's own transient
// state -- never sent anywhere else, never written to the database, and
// discarded outright on unmount/navigation. Permission-denied or any
// fetch failure silently reverts to the household default -- no error UI,
// per the explicit ask.
'use client';

import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

type LocatedResult = { time: string; dateLabel: string | null };

export default function LocationZmanim({
  propertyName,
  defaultTime,
  defaultDateLabel,
}: {
  propertyName: string | null;
  defaultTime: string;
  defaultDateLabel: string | null;
}) {
  const [status, setStatus] = useState<'default' | 'loading' | 'located'>('default');
  const [result, setResult] = useState<LocatedResult | null>(null);

  function handleToggle() {
    if (status === 'located') {
      setStatus('default');
      setResult(null);
      return;
    }
    if (status === 'loading') return;

    if (!('geolocation' in navigator)) return; // no error state, just stay on default

    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
          const res = await fetch(
            `/api/zmanim?lat=${latitude}&lng=${longitude}&tzid=${encodeURIComponent(tzid)}`
          );
          if (!res.ok) throw new Error();
          const data = await res.json();
          if (!data.candleTime) throw new Error();
          setResult({ time: data.candleTime, dateLabel: data.candleDateLabel ?? null });
          setStatus('located');
        } catch {
          setStatus('default');
        }
        // latitude/longitude go out of scope here -- never stored, never
        // logged, never sent anywhere beyond the one fetch above.
      },
      () => {
        // Permission denied, timeout, or position unavailable -- silently
        // stay on the household default, no error message.
        setStatus('default');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }

  const located = status === 'located' && result;

  return (
    <>
      <span aria-hidden="true">🕯️</span>
      <span>
        {located ? (
          <>
            Candle Lighting near you{result.dateLabel ? ` · ${result.dateLabel}` : ''} ·{' '}
            <bdi dir="ltr">{result.time}</bdi>
          </>
        ) : (
          <>
            Candle Lighting{propertyName ? ` · ${propertyName}` : ''}
            {defaultDateLabel ? ` · ${defaultDateLabel}` : ''} · <bdi dir="ltr">{defaultTime}</bdi>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={status === 'loading'}
        aria-label={located ? 'Switch back to household location' : 'Use my current location for candle lighting'}
        title={located ? 'Switch back to household location' : 'Use my current location'}
        className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full transition-colors disabled:opacity-60 ${
          located ? 'text-gold-dark bg-gold-light/30' : 'text-muted2 hover:bg-stone'
        }`}
      >
        {status === 'loading' ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <MapPin size={13} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
