// scripts/extract-video-posters.ts
// Poster ruling (Racquel, 2 Aug evening): extract a poster frame from
// EVERY existing training video, store it, point poster_path at it, and
// set alt text EN/ES from the titles. All 32.
//
// WHY A SCRIPT: video bytes live in a private storage bucket. Reading
// them requires the service-role key, and frame extraction requires
// ffmpeg -- neither exists inside the remote Code container (no secrets,
// egress proxy). Run this anywhere both exist (Racquel's machine or CI):
//
//   SUPABASE_URL=https://jfaaqzrezcrkkidlsbwj.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   npx tsx scripts/extract-video-posters.ts
//
// Idempotent: rows that already have poster_path are skipped, so this is
// also the "auto-extract going forward" path -- re-run it after any new
// upload (or wire it as a post-upload step) and only new clips process.
// Mid-frame heuristic: seek to 50% of duration -- for short SOP clips the
// midpoint is reliably "hands doing the task", never the black lead-in.
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, key);

const POSTER_BUCKET = 'training-videos'; // posters live beside the clips
const POSTER_PREFIX = 'posters/';

async function main() {
  const { data: videos, error } = await supabase
    .from('training_videos')
    .select('id, slug, title_en, title_es, bucket, storage_path, duration_seconds, poster_path')
    .order('slug');
  if (error) throw error;

  const work = (videos ?? []).filter((v) => !v.poster_path);
  console.log(`${videos?.length ?? 0} videos, ${work.length} need posters.`);

  const dir = mkdtempSync(join(tmpdir(), 'posters-'));
  let done = 0;
  for (const v of work) {
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(v.bucket)
        .createSignedUrl(v.storage_path, 600);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('no signed url');

      const videoFile = join(dir, `${v.slug}.mp4`);
      const posterFile = join(dir, `${v.slug}.jpg`);
      const res = await fetch(signed.signedUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      writeFileSync(videoFile, Buffer.from(await res.arrayBuffer()));

      // Seek to the midpoint (fall back to 2s when duration is unknown).
      const mid = v.duration_seconds ? Math.max(0.5, v.duration_seconds / 2) : 2;
      execFileSync('ffmpeg', [
        '-y', '-ss', String(mid), '-i', videoFile,
        '-frames:v', '1', '-q:v', '3', '-vf', 'scale=1280:-2',
        posterFile,
      ], { stdio: 'pipe' });

      const posterPath = `${POSTER_PREFIX}${v.slug}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(POSTER_BUCKET)
        .upload(posterPath, readFileSync(posterFile), { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase
        .from('training_videos')
        .update({
          poster_path: posterPath,
          poster_alt_en: `${v.title_en} — video poster frame`,
          poster_alt_es: `${v.title_es || v.title_en} — fotograma del video`,
        })
        .eq('id', v.id);
      if (rowErr) throw rowErr;

      done++;
      console.log(`ok  ${v.slug}`);
    } catch (e) {
      console.error(`FAIL ${v.slug}:`, e instanceof Error ? e.message : e);
    }
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`${done}/${work.length} posters extracted.`);
}

main();
