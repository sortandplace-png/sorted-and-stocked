// app/properties/[id]/staff/training/page.tsx
// Signed URLs are minted HERE, server-side, using the caller's own session --
// so the training_videos_read_authenticated policy is what actually decides
// access. A signed URL is never generated for a signed-out visitor, and the
// underlying objects are unreachable by public URL (verified: 400).
import { createClient } from '@/lib/supabase/server';
import TrainingClient, { type SignedVideo } from '@/components/TrainingClient';
import { TRAINING_VIDEOS, SIGNED_URL_TTL_SECONDS } from '@/lib/training-videos';

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // One batch call rather than six round trips.
  const { data: signed } = await supabase.storage
    .from('training-videos')
    .createSignedUrls(
      TRAINING_VIDEOS.map((v) => v.path),
      SIGNED_URL_TTL_SECONDS
    );

  const byPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));

  // Captions get their own batch, same pattern and same bucket. Skipped
  // entirely when no video declares one, so this costs nothing until the
  // first .vtt is uploaded -- and createSignedUrls is never handed an
  // empty array. A failure here must not take the videos down with it:
  // an unsigned caption just means no <track>, which is the state the
  // page is in today anyway.
  const captionPaths = TRAINING_VIDEOS.map((v) => v.captionPath).filter(
    (p): p is string => Boolean(p)
  );
  const captionByPath = new Map<string, string | null>();
  if (captionPaths.length > 0) {
    const { data: signedCaptions } = await supabase.storage
      .from('training-videos')
      .createSignedUrls(captionPaths, SIGNED_URL_TTL_SECONDS);
    for (const s of signedCaptions ?? []) captionByPath.set(s.path ?? '', s.signedUrl);
  }

  const videos: SignedVideo[] = TRAINING_VIDEOS.map((v) => ({
    path: v.path,
    order: v.order,
    titleKey: v.titleKey,
    href: v.href ? v.href(id) : null,
    // Null when signing failed -- the client renders an honest "unavailable"
    // row rather than a dead <video> element.
    signedUrl: byPath.get(v.path) ?? null,
    captionSignedUrl: v.captionPath ? captionByPath.get(v.captionPath) ?? null : null,
  }));

  return <TrainingClient videos={videos} />;
}
