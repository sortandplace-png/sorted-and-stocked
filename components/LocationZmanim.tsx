// components/LocationZmanim.tsx
// Opt-in "use my location" toggle next to the Home dashboard's household
// candle-lighting time. Never automatic -- starts on the household default
// on every page load, only switches on an explicit tap. Coordinates from
// the browser's Geolocation API are used for exactly one fetch to
// /api/zmanim and held only in this component's own transient state --
// never sent anywhere else, never written to the database, and discarded
// outright on unmount/navigation. Permission-denied or any fetch failure
// silently reverts to the household default -- no error UI, per the
// explicit ask.
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Loader2 } from 'lucide-react';

type LocatedResult = { time: string; dateLabel: string | null };

// `dark` is the new direction's Candle Lighting card (a dark photo-gradient
// background) -- `light` is kept for any future placement back on a
// cream/card background, same component either way, just the button/text
// colors adapt.
export default function LocationZmanim({
  propertyName,
  defaultTime,
  defaultDateLabel,
  variant = 'light',
}: {
  propertyName: string | null;
  defaultTime: string;
  defaultDateLabel: string | null;
  variant?: 'light' | 'dark';
}) {
  const t = useTranslations('dashboard.candle');
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
  const dark = variant === 'dark';

  // Dark variant (Candle Lighting footer): matches the Concept B Figma spec's
  // centered, time-first layout -- large serif time is the dominant element,
  // date/location a small italic line below. No separate "Candle Lighting"
  // label here since the card's own header bar already says that. The real
  // geolocation toggle (not part of the static Figma mockup) sits as a small
  // icon beside the time rather than the old side-by-side label+button row.
  if (dark) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-2">
          <bdi dir="ltr" className="font-display text-[24px] text-white tracking-[0.04em] leading-none">
            {located ? result.time : defaultTime}
          </bdi>
          <button
            type="button"
            onClick={handleToggle}
            disabled={status === 'loading'}
            aria-label={located ? t('switchToHousehold') : t('useMyLocation')}
            title={located ? t('switchToHousehold') : t('useMyLocationTitle')}
            className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full transition-colors disabled:opacity-60 ${
              located ? 'text-white bg-white/25' : 'text-white/60 bg-white/10 hover:bg-white/20'
            }`}
          >
            {status === 'loading' ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <MapPin size={12} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="font-display italic text-[12px] text-white/60 tracking-wide">
          {located
            ? `${result.dateLabel ? `${result.dateLabel} — ` : ''}${t('labelNearYou')}`
            : `${defaultDateLabel ? `${defaultDateLabel}` : ''}${propertyName ? ` — ${propertyName}` : ''}`}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="text-[10px] tracking-[0.16em] uppercase mb-1.5 text-dusk">
          {located ? t('labelNearYou') : `${t('label')}${propertyName ? ` · ${propertyName}` : ''}`}
        </div>
        <div className="font-display text-[18px] text-denim">
          {located ? (
            <>
              {result.dateLabel ? `${result.dateLabel} · ` : ''}
              <bdi dir="ltr">{result.time}</bdi>
            </>
          ) : (
            <>
              {defaultDateLabel ? `${defaultDateLabel} · ` : ''}
              <bdi dir="ltr">{defaultTime}</bdi>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={status === 'loading'}
        aria-label={located ? t('switchToHousehold') : t('useMyLocation')}
        title={located ? t('switchToHousehold') : t('useMyLocationTitle')}
        className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors disabled:opacity-60 ${
          located ? 'text-brass bg-mist' : 'text-dusk hover:bg-mist'
        }`}
      >
        {status === 'loading' ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <MapPin size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
