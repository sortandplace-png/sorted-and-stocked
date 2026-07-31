// components/TrainingVideosTab.tsx
// The Handbook's third tab, and the standalone /staff/training route --
// both read the training_videos table via /lib/training-videos, which
// mints the signed URLs (private buckets, unreachable by public URL).
//
// SS-443 rebuild. The old version was a flat list of 33 full-width native
// <video> elements with no posters -- a wall of black rectangles. Now:
//   - Grouped sections by category (bilingual, from the table -- new
//     categories arrive with new rows, no deploy), with filter chips.
//   - Fixed aspect-video cards in a 2-up grid on desktop, Concept B
//     tiles (rounded-xl2, Pin dot per card, no brass fills -- R9/D-01).
//   - A branded facade instead of a raw video element: poster image when
//     the row has one, otherwise a mist gradient with a denim play
//     button. The <video> mounts only on tap, so nothing on this page is
//     ever a black box and 33 players don't mount at once.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
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

  const [filter, setFilter] = useState<string | null>(null);
  // Cards whose facade has been tapped -- only these mount a <video>.
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  // Categories in first-appearance order (rows arrive already sorted by
  // sort_order, so the section order is Racquel's ordering, not
  // alphabetical).
  const categories = useMemo(() => {
    const seen = new Map<string, { en: string; es: string | null }>();
    for (const v of videos) {
      if (!seen.has(v.categoryEn)) seen.set(v.categoryEn, { en: v.categoryEn, es: v.categoryEs });
    }
    return [...seen.values()];
  }, [videos]);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-dusk text-center py-10 bg-card rounded-xl2 border border-cardBorder shadow-card">
        {t('empty')}
      </p>
    );
  }

  const sections = categories
    .filter((c) => filter === null || c.en === filter)
    .map((c) => ({ category: c, videos: videos.filter((v) => v.categoryEn === c.en) }));

  return (
    <div className="space-y-6">
      {/* Filter chips -- only worth the row once there are 2+ categories. */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
              filter === null
                ? 'bg-denim text-white border-denim shadow-sm'
                : 'bg-card text-denim/70 border-cardBorder hover:bg-mist'
            }`}
          >
            {t('allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.en}
              onClick={() => setFilter(filter === c.en ? null : c.en)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                filter === c.en
                  ? 'bg-denim text-white border-denim shadow-sm'
                  : 'bg-card text-denim/70 border-cardBorder hover:bg-mist'
              }`}
            >
              {pick(c.en, c.es)}
            </button>
          ))}
        </div>
      )}

      {sections.map(({ category, videos: sectionVideos }) => (
        <section key={category.en}>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="font-display text-[17px] text-denim">{pick(category.en, category.es)}</h2>
            <span className="text-[11px] text-dusk tabular-nums">{sectionVideos.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {sectionVideos.map((v) => {
              const title = pick(v.titleEn, v.titleEs) ?? v.slug;
              const description = pick(v.descriptionEn, v.descriptionEs);
              const posterAlt = pick(v.posterAltEn, v.posterAltEs) ?? title;
              const length = runtime(v.durationSeconds);
              const isPlaying = playing.has(v.id);

              return (
                <div
                  key={v.id}
                  className="relative bg-card rounded-xl2 border border-cardBorder shadow-card p-4 pr-8"
                >
                  <Pin size="sm" />
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-display text-[17px] text-denim leading-snug">{title}</h3>
                    {length && (
                      <span className="text-[10px] text-dusk bg-mist border border-cardBorder px-2 py-0.5 rounded-full tabular-nums">
                        {length}
                      </span>
                    )}
                  </div>
                  {description && (
                    <p className="text-[13px] text-denim mt-1.5 leading-relaxed">{description}</p>
                  )}

                  {v.signedUrl ? (
                    // Fixed 16:9 media well. Letterboxing (portrait phone
                    // clips) lands on mist, never black.
                    <div className="relative aspect-video mt-3 rounded-xl2 border border-cardBorder bg-mist overflow-hidden">
                      {isPlaying ? (
                        <video
                          controls
                          autoPlay
                          poster={v.posterUrl ?? undefined}
                          // SS-364: a video watched to the end here must not
                          // resurface in the onboarding modal -- both write
                          // the same training_video_views row (unique on
                          // user_id+video_id).
                          onEnded={() => markVideoCompleted(supabase, userId, v.id)}
                          className="absolute inset-0 w-full h-full object-contain"
                        >
                          <source src={v.signedUrl} type="video/mp4" />
                          {/* SS-293. The .vtt files are Spanish, so the track
                              is declared Spanish regardless of UI language --
                              labelling it with the current locale would claim
                              English captions exist when they do not. default
                              only in Spanish. */}
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
                        <button
                          onClick={() => setPlaying((prev) => new Set(prev).add(v.id))}
                          aria-label={`${t('play')}: ${title}`}
                          className="group absolute inset-0 w-full h-full"
                        >
                          {v.posterUrl ? (
                            // Signed URL from a private bucket -- next/image can't
                            // optimize it and would leak the token into the optimizer URL.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.posterUrl}
                              alt={posterAlt}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <span className="absolute inset-0 bg-gradient-to-br from-mist to-linen" aria-hidden="true" />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-12 h-12 rounded-full bg-white/95 shadow-cardHover flex items-center justify-center transition-transform group-hover:scale-105">
                              <Play size={20} strokeWidth={2} className="text-denim ml-0.5" aria-hidden="true" />
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    // Signing failed. Says so rather than rendering a dead player.
                    <p className="text-[12px] text-dusk italic mt-3">{t('unavailable')}</p>
                  )}

                  {/* The page this video is about. The slug -> route map
                      lives in code (lib/training-videos.ts). */}
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
        </section>
      ))}
    </div>
  );
}
