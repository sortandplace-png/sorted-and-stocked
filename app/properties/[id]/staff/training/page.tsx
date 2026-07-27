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

  const videos: SignedVideo[] = TRAINING_VIDEOS.map((v) => ({
    path: v.path,
    order: v.order,
    titleKey: v.titleKey,
    href: v.href ? v.href(id) : null,
    // Null when signing failed -- the client renders an honest "unavailable"
    // row rather than a dead <video> element.
    signedUrl: byPath.get(v.path) ?? null,
  }));

  return <TrainingClient videos={videos} />;
}
