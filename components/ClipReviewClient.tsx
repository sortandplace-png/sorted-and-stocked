// components/ClipReviewClient.tsx
// SS-430 (ruled 2 Aug eve): the owner-only clip review queue. Lists
// every INACTIVE training_videos row (the 24 placed sop clips) with an
// inline player and a per-clip Approve that flips active=true -- her R18
// watch, in-app instead of a file-by-file storage crawl. Read/update
// power comes from migration 171's operator-owner policies; the server
// page gates the route the same way. English-only (operator surface).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Clip = {
  id: string;
  slug: string;
  title_en: string;
  category_en: string | null;
  bucket: string;
  storage_path: string;
  duration_seconds: number | null;
  poster_path: string | null;
  replace_requested: boolean;
};

export default function ClipReviewClient() {
  const supabase = createClient();
  const showToast = useToast();
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [signedByPath, setSignedByPath] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('training_videos')
      .select('id, slug, title_en, category_en, bucket, storage_path, duration_seconds, poster_path, replace_requested')
      .eq('active', false)
      .order('slug');
    if (error) {
      // A permission failure must look like one, not like an empty queue
      // (the SS-457 P0 lesson).
      showToast(`Could not load the queue: ${error.message}`, { variant: 'error' });
      setClips([]);
      return;
    }
    setClips(data ?? []);
    const signed: Record<string, string> = {};
    for (const clip of data ?? []) {
      const { data: url } = await supabase.storage.from(clip.bucket).createSignedUrl(clip.storage_path, 3600);
      if (url?.signedUrl) signed[clip.storage_path] = url.signedUrl;
    }
    setSignedByPath(signed);
  }, [supabase, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(clip: Clip) {
    setBusyId(clip.id);
    const { error } = await supabase.from('training_videos').update({ active: true }).eq('id', clip.id);
    setBusyId(null);
    if (error) {
      showToast(`Approve failed: ${error.message}`, { variant: 'error' });
      return;
    }
    setClips((prev) => (prev ?? []).filter((c) => c.id !== clip.id));
    showToast(`${clip.title_en} approved and live.`, { variant: 'success' });
  }

  // Handbook-polish ruling (2 Aug midnight): a clip with AI artifacts gets
  // flagged for re-recording instead of approved. It stays inactive and
  // stays in this queue, visibly marked, so the worklist IS the flag list.
  async function toggleReplace(clip: Clip) {
    const next = !clip.replace_requested;
    setBusyId(clip.id);
    const { error } = await supabase.from('training_videos').update({ replace_requested: next }).eq('id', clip.id);
    setBusyId(null);
    if (error) {
      showToast(`Flag failed: ${error.message}`, { variant: 'error' });
      return;
    }
    setClips((prev) => (prev ?? []).map((c) => (c.id === clip.id ? { ...c, replace_requested: next } : c)));
    showToast(next ? `${clip.title_en} flagged for replacement.` : `Replacement flag cleared.`, {
      variant: 'success',
    });
  }

  if (clips === null) return <SkeletonList />;

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Clip Review</h1>
      <p className="text-sm text-dusk mb-5">
        {clips.length} clip{clips.length === 1 ? '' : 's'} waiting on your watch. Approve flips a clip live in
        the training library; leave anything you have not watched.
      </p>

      {clips.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-xl2 border border-cardBorder shadow-card">
          Nothing waiting. Every clip is live.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clips.map((clip) => (
            <div key={clip.id} className="relative bg-card rounded-xl2 border border-cardBorder shadow-card overflow-hidden">
              {signedByPath[clip.storage_path] ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={signedByPath[clip.storage_path]}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full aspect-video bg-denim"
                />
              ) : (
                <div className="w-full aspect-video bg-mist flex items-center justify-center text-xs text-dusk">
                  Signing video…
                </div>
              )}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-denim truncate">{clip.title_en}</p>
                  <p className="text-xs text-dusk">
                    {clip.category_en ?? 'Uncategorized'}
                    {clip.duration_seconds ? ` · ${Math.round(clip.duration_seconds)}s` : ''}
                    {/* Poster frames arrive with the SS-481 photo shoot; the
                        queue shows which clips still lack one. */}
                    {clip.poster_path ? ' · poster set' : ' · no poster yet'}
                  </p>
                  {clip.replace_requested && (
                    <p className="text-[11px] font-medium text-[#B5636B] mt-0.5">
                      Flagged for replacement (AI artifacts)
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => toggleReplace(clip)}
                    disabled={busyId === clip.id}
                    className="text-xs font-medium text-denim border border-cardBorder bg-mist px-3 py-2 rounded-full disabled:opacity-40"
                  >
                    {clip.replace_requested ? 'Unflag' : 'Replace'}
                  </button>
                  <button
                    onClick={() => approve(clip)}
                    disabled={busyId === clip.id}
                    className="text-xs font-medium text-white bg-denim px-4 py-2 rounded-full disabled:opacity-40"
                  >
                    {busyId === clip.id ? '…' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
