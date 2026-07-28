// components/TrainingClient.tsx
// Staff training series. Plays from the PRIVATE training-videos bucket via
// short-lived signed URLs minted server-side -- see the page component.
//
// KNOWN GAP, still not closed: all six videos are English with no Spanish
// track. The staff this series is built for are Spanish-speaking, so today
// they get the visuals and little else. Closing it needs Spanish captions
// (.vtt) or re-recorded audio -- a content task.
//
// The code side of it is now real (SS-293). This comment previously claimed
// the <video> element "already renders a <track> when a captions file
// exists"; it did not -- there was no <track> in this file at all. It does
// now, driven by captionPath in lib/training-videos.ts, and the bucket
// holds no .vtt yet, so nothing renders one until one is uploaded.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Pin from '@/components/PinAccent';
import { Play, ExternalLink, X } from 'lucide-react';

export type SignedVideo = {
  path: string;
  order: number;
  titleKey: string;
  href: string | null;
  signedUrl: string | null;
  /** Signed URL for the Spanish .vtt, or null when the video has none. */
  captionSignedUrl: string | null;
};

export default function TrainingClient({ videos }: { videos: SignedVideo[] }) {
  const t = useTranslations('training');
  // Starts null, not videos[0]. The player is a modal now, and seeding this
  // with the first video would pop that modal open over the list the moment
  // the page loads, before anyone has chosen anything to watch.
  const [activePath, setActivePath] = useState<string | null>(null);

  const active = videos.find((v) => v.path === activePath) ?? null;

  // Escape closes, same as the X and the backdrop. A modal that traps you
  // because you reached for the key every other dialog uses is worse than
  // no modal.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePath(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-3">{t('description')}</p>

      {/* The player is an overlay now, not a card above the list. The list
          keeps its own scroll position and the video gets the screen while
          it is being watched. Everything inside -- signed URL, the caption
          <track>, crossOrigin, the English-only notice -- is the same code
          that ran in the main column, relocated rather than rewritten.

          Backdrop and shell match ToolModal's established pattern: full
          screen, bottom-sheet on a phone, centred from sm up, with
          stopPropagation on the panel so a tap inside never closes it. */}
      {active?.signedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center sm:p-4"
          onClick={() => setActivePath(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t(active.titleKey)}
        >
        <div
          className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-card rounded-t-xl3 sm:rounded-xl3 border border-cardBorder shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          <Pin size="sm" />
          <button
            onClick={() => setActivePath(null)}
            aria-label={t('close')}
            className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-denim/70 text-white flex items-center justify-center"
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {/* Stated in the product, not just in a code comment -- a staff
              member who can't follow the audio should be told why, not left
              to assume the app is broken for them.

              Tied to the video actually being watched rather than shown
              unconditionally: once a video has a Spanish track, telling its
              viewer it is English-only is simply false, and a notice that is
              sometimes wrong stops being read at all. */}
          {!active.captionSignedUrl && (
            <p className="text-xs text-denim bg-linen px-3 py-2">{t('englishOnlyNotice')}</p>
          )}

          <video
            key={active.path}
            src={active.signedUrl}
            controls
            playsInline
            preload="metadata"
            // A cross-origin text track is only fetched when the media
            // element is CORS-enabled, so this is required for the <track>
            // to load from Supabase at all -- and set only when there is a
            // track, to leave plain video playback exactly as it was.
            crossOrigin={active.captionSignedUrl ? 'anonymous' : undefined}
            className="w-full bg-denim aspect-video"
          >
            {active.captionSignedUrl && (
              <track
                kind="captions"
                srcLang="es"
                label="Español"
                src={active.captionSignedUrl}
                default
              />
            )}
          </video>
          <div className="p-4">
            <p className="font-display text-lg text-denim">{t(active.titleKey)}</p>
            {active.href && (
              <Link
                href={active.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-denim underline underline-offset-2 mt-1"
              >
                {t('openSection')} <ExternalLink size={11} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        </div>
      )}

      <ul className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2.5">
        {videos.map((v) => {
          const isActive = v.path === activePath;
          const unavailable = !v.signedUrl;
          return (
            <li key={v.path}>
              <button
                onClick={() => !unavailable && setActivePath(v.path)}
                disabled={unavailable}
                aria-current={isActive}
                className={`relative w-full text-left flex items-center gap-3 rounded-xl2 border shadow-card px-4 py-3.5 transition-shadow ${
                  isActive ? 'bg-mist border-brass/40' : 'bg-card border-cardBorder hover:shadow-cardHover'
                } ${unavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Pin size="sm" />
                <span className="w-9 h-9 shrink-0 rounded-full bg-mist flex items-center justify-center">
                  <Play size={16} className="text-brass" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-brass">
                    {t('videoNumber', { n: v.order })}
                  </span>
                  <span className="block font-medium text-denim truncate">{t(v.titleKey)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {videos.every((v) => !v.signedUrl) && (
        <p className="text-sm text-dusk text-center py-6">{t('unavailable')}</p>
      )}
    </div>
  );
}
