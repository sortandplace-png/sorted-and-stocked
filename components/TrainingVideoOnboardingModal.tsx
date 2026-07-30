// components/TrainingVideoOnboardingModal.tsx
// SS-364: onboarding by use rather than by expecting someone to visit the
// Training page. On each session (browser tab session, via sessionStorage --
// one per session, never two even if this component somehow mounted twice),
// finds the next training_videos row this user hasn't completed or
// dismissed, signs it, and shows it as a dismissible modal. Naturally stops
// once every eligible video has a training_video_views row with
// completed_at or dismissed_at set -- no separate "sequence finished" flag
// needed, the absence of a next candidate IS that state.
//
// Deliberately NOT rendered while StaffOnboardingModal is still showing
// (see app/properties/[id]/layout.tsx) -- a brand-new staff member's very
// first session is the welcome tour, not a second competing modal on top of
// it. The video sequence starts from their next session.
'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SIGNED_URL_TTL_SECONDS } from '@/lib/training-videos';
import { markVideoCompleted, markVideoFirstShown, markVideoDismissed } from '@/lib/training-video-views';
import type { PropertyRole } from '@/components/PropertyRoleContext';

const SESSION_FLAG = 'training-onboarding-shown-this-session';

type NextVideo = {
  id: string;
  titleEn: string;
  titleEs: string | null;
  signedUrl: string;
  captionSignedUrl: string | null;
};

export default function TrainingVideoOnboardingModal({ userId, role }: { userId: string; role: PropertyRole }) {
  const [video, setVideo] = useState<NextVideo | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const locale = useLocale();
  const t = useTranslations('trainingOnboarding');
  const supabase = createClient();

  // owner/manager map to the 'homeowner' audience tag; staff to 'staff'.
  // 'all' is always included. Every video is tagged 'all' as of the 29 Jul
  // retagging, so this mapping is currently a no-op in practice -- kept
  // correct for whenever a video is scoped narrower again, rather than
  // hardcoding "everything matches."
  const audienceTag = role === 'staff' ? 'staff' : 'homeowner';

  async function seenVideoIds(): Promise<Set<string>> {
    const { data } = await supabase
      .from('training_video_views')
      .select('video_id')
      .eq('user_id', userId)
      .or('completed_at.not.is.null,dismissed_at.not.is.null');
    return new Set((data ?? []).map((r) => r.video_id as string));
  }

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    let cancelled = false;

    (async () => {
      const seenIds = await seenVideoIds();
      const { data: candidates } = await supabase
        .from('training_videos')
        .select('id, bucket, storage_path, caption_path, title_en, title_es')
        .eq('active', true)
        .in('audience', ['all', audienceTag])
        .order('sort_order');

      const next = (candidates ?? []).find((c) => !seenIds.has(c.id));
      if (!next || cancelled) return;

      const paths = next.caption_path ? [next.storage_path, next.caption_path] : [next.storage_path];
      const { data: signed } = await supabase.storage.from(next.bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      const signedUrl = signed?.find((s) => s.path === next.storage_path)?.signedUrl;
      // Signing failed -- skip quietly rather than show a broken player.
      // Next session will try again; this row never gets a first_shown_at.
      if (!signedUrl || cancelled) return;
      const captionSignedUrl = next.caption_path
        ? signed?.find((s) => s.path === next.caption_path)?.signedUrl ?? null
        : null;

      sessionStorage.setItem(SESSION_FLAG, '1');
      setVideo({ id: next.id, titleEn: next.title_en, titleEs: next.title_es, signedUrl, captionSignedUrl });
      markVideoFirstShown(supabase, userId, next.id);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, audienceTag]);

  if (!video) return null;

  const title = locale === 'es' && video.titleEs ? video.titleEs : video.titleEn;

  function close() {
    // Plain close, not a permanent skip -- first_shown_at is set but
    // neither completed_at nor dismissed_at, so the same video is simply
    // the next candidate again next session.
    setVideo(null);
  }

  async function onEnded() {
    await markVideoCompleted(supabase, userId, video!.id);
    setVideo(null);
  }

  async function dismissAll() {
    setDismissing(true);
    // "Don't show these again": every remaining not-yet-seen video
    // (including this one) gets dismissed_at in one action, so the next-
    // candidate query above finds nothing from here on -- no separate
    // opt-out flag needed, the register of already-dismissed rows IS the
    // opt-out.
    const seenIds = await seenVideoIds();
    const { data: all } = await supabase
      .from('training_videos')
      .select('id')
      .eq('active', true)
      .in('audience', ['all', audienceTag]);
    const remaining = (all ?? []).filter((v) => !seenIds.has(v.id));
    await Promise.all(remaining.map((v) => markVideoDismissed(supabase, userId, v.id)));
    setDismissing(false);
    setVideo(null);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-linen rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cardBorder">
          <span className="font-display text-[17px] text-denim truncate pr-3">{title}</span>
          <button
            onClick={close}
            aria-label={t('close')}
            className="w-9 h-9 shrink-0 flex items-center justify-center text-dusk"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {/* autoPlay, unlike TrainingVideosTab's preload="none" -- this modal
            only ever appears because the app chose to show it, so the
            person did not need to opt into playback the way someone
            browsing a list of videos does. */}
        <video controls autoPlay onEnded={onEnded} className="w-full bg-mist">
          <source src={video.signedUrl} type="video/mp4" />
          {video.captionSignedUrl && (
            <track
              kind="subtitles"
              src={video.captionSignedUrl}
              srcLang="es"
              label={t('captionsEs')}
              default={locale === 'es'}
            />
          )}
        </video>
        <div className="flex items-center justify-between px-5 py-3.5">
          <button
            onClick={dismissAll}
            disabled={dismissing}
            className="text-xs text-dusk underline disabled:opacity-40"
          >
            {t('dontShowAgain')}
          </button>
          <button onClick={close} className="text-sm font-medium text-denim">
            {t('dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
