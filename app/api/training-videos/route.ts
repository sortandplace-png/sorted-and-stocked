// GET /api/training-videos?propertyId=<uuid>
//
// The Handbook's Training Videos tab lazy-loads through here rather than
// querying from the browser, because the video objects are NOT public: they
// live in a private bucket and need signed URLs, and a signed URL can only
// be minted server-side. Signed with the CALLER'S session, so
// training_videos_read_authenticated is what decides access.
//
// The list and the signing both come from lib/training-videos.ts, shared
// with the /staff/training page -- one source, one place to get the
// per-bucket handling right.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedTrainingVideos } from '@/lib/training-videos';

export async function GET(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Only used to resolve each video's "go there now" link. Absent is fine:
  // the links simply do not render.
  const propertyId = new URL(req.url).searchParams.get('propertyId') ?? '';

  const videos = await getSignedTrainingVideos(supabase, propertyId);
  return NextResponse.json({ videos });
}
