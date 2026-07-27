// components/TrainingClient.tsx
// Staff training series. Plays from the PRIVATE training-videos bucket via
// short-lived signed URLs minted server-side -- see the page component.
//
// KNOWN GAP, flagged not solved (per instruction): all six videos are English
// with no captions and no Spanish track. The staff this series is built for
// are Spanish-speaking, so today they get the visuals and little else. That
// needs either Spanish captions (.vtt) or re-recorded audio; the <video>
// element below already renders a <track> when a captions file exists, so
// adding one later is a content task, not a code change.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Pin from '@/components/PinAccent';
import { Play, ExternalLink } from 'lucide-react';

export type SignedVideo = {
  path: string;
  order: number;
  titleKey: string;
  href: string | null;
  signedUrl: string | null;
};

export default function TrainingClient({ videos }: { videos: SignedVideo[] }) {
  const t = useTranslations('training');
  const [activePath, setActivePath] = useState<string | null>(videos[0]?.path ?? null);

  const active = videos.find((v) => v.path === activePath) ?? null;

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-3">{t('description')}</p>

      {/* Stated in the product, not just in a code comment -- a staff member
          who can't follow the audio should be told why, not left to assume
          the app is broken for them. */}
      <p className="text-xs text-brass bg-linen rounded-xl2 px-3 py-2 mb-4">{t('englishOnlyNotice')}</p>

      {active?.signedUrl && (
        <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden mb-4">
          <Pin size="sm" />
          <video
            key={active.path}
            src={active.signedUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full bg-denim aspect-video"
          />
          <div className="p-4">
            <p className="font-display text-lg text-denim">{t(active.titleKey)}</p>
            {active.href && (
              <Link
                href={active.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-brass underline underline-offset-2 mt-1"
              >
                {t('openSection')} <ExternalLink size={11} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            )}
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
