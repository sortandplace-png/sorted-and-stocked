// app/properties/[id]/staff/training/page.tsx
// Signed URLs are minted HERE, server-side, using the caller's own session --
// so the training_videos_read_authenticated policy is what actually decides
// access. A signed URL is never generated for a signed-out visitor, and the
// underlying objects are unreachable by public URL (verified: 400).
//
// Now reads the training_videos TABLE through the shared helper rather than
// a hardcoded list, so this page and the Handbook's Training Videos tab can
// no longer disagree about which videos exist. That also means the
// deactivated row stops rendering here, and the two rows the constant never
// knew about start to.
//
// The route is unchanged and still reachable (R21) even though it is no
// longer in the nav -- the Handbook's Videos tab is where people are sent.
import { createClient } from '@/lib/supabase/server';
import { getSignedTrainingVideos } from '@/lib/training-videos';
import TrainingVideosTab from '@/components/TrainingVideosTab';

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const videos = await getSignedTrainingVideos(supabase, id);

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <TrainingVideosTab videos={videos} />
      </div>
    </div>
  );
}
