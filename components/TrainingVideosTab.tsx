// components/TrainingVideosTab.tsx
// The Handbook's third tab. Reads the training_videos table through
// /api/training-videos, which mints the signed URLs -- the objects are in a
// private bucket and are unreachable by public URL.
//
// Rendered by BOTH the Handbook tab and the standalone /staff/training
// route, which now read the same table through the same helper. This
// replaced TrainingClient, which was deleted once it was unmounted and
// superseded.
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import Pin from '@/components/ui/Pin';
import type { TrainingVideo } from '@/lib/training-videos';
import { createClient } from '@/lib/supabase/client';
import { markVideoCompleted } from '@/lib/training-video-views';

function runtime(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TrainingVideosTab({ videos, userId }: { videos: TrainingVideo[]; userId: string }) {
  const t = useTranslations('trainingVideos');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  // Falls back to English rather than rendering an empty title when a
  // Spanish field is blank -- readable, never missing.
  const pick = (en: string | null, esVal: string | null) => (es && esVal ? esVal : en);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
        {t('empty')}
      </p>
    );
  }

  return (
    <div className="space-y-[14px]">
      {videos.map((v) => {
        const title = pick(v.titleEn, v.titleEs) ?? v.slug;
        const description = pick(v.descriptionEn, v.descriptionEs);
        const length = runtime(v.durationSeconds);
        return (
          <div
            key={v.id}
            className="relative bg-card rounded-xl2 border border-cardBorder shadow-card p-4 pr-8"
          >
            <Pin size="sm" />
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="font-display text-[19px] text-denim leading-snug">{title}</h3>
              {length && (
                <span className="text-[10px] text-dusk bg-mist border border-cardBorder px-2 py-0.5 rounded-full tabular-nums">
                  {length}
                </span>
              )}
            </div>
            {description && <p className="text-[13px] text-denim mt-1.5 leading-relaxed">{description}</p>}

            {v.signedUrl ? (
              <video
                controls
                preload="none"
                // SS-364: a video watched to the end here must not resurface
                // in the onboarding modal -- both write the same
                // training_video_views row (unique on user_id+video_id), so
                // this is the one place "watched" gets recorded from the
                // real Training page.
                onEnded={() => markVideoCompleted(supabase, userId, v.id)}
                className="w-full mt-3 rounded-xl2 border border-cardBorder bg-mist"
              >
                <source src={v.signedUrl} type="video/mp4" />
                {/* SS-293. The .vtt files are Spanish, so the track is
                    declared as Spanish regardless of the reader's UI
                    language -- labelling it with the current locale would
                    tell the browser English captions exist when they do
                    not. default only in Spanish: captions a reader cannot
                    read should not switch themselves on. */}
                {v.captionSignedUrl && (
                  <track
                    kind="subtitles"
                    src={v.captionSignedUrl}
                    srcLang="es"
                    label={t('captionsEs')}
                    default={es}
                  />
                )}
              </video>
            ) : (
              // Signing failed. Says so rather than rendering a dead player.
              <p className="text-[12px] text-dusk italic mt-3">{t('unavailable')}</p>
            )}

            {/* The page this video is about. Preserved from the old
                hardcoded list -- it was a real feature and the table has no
                column for it, so the slug -> route map lives in code. */}
            {v.href && (
              <Link
                href={v.href}
                className="inline-block mt-2.5 text-[12px] font-medium text-denim underline underline-offset-2"
              >
                {t('goThere')}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
