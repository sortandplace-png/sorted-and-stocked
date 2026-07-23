// supabase/functions/storage-backup/index.ts
//
// Postgres has daily backups (Supabase-managed); Storage does not. This
// mirrors every real photo bucket into a matching `-backup` bucket in the
// same project on a schedule (see migration 085), so an accidental delete
// or overwrite in a live bucket is still recoverable from its backup twin.
//
// Incremental by design, not a full re-copy every run: every real upload
// path in this app names files `${id}-${Date.now()}.jpg` (or a fresh
// crypto.randomUUID()), so a *replaced* photo gets a brand-new path rather
// than overwriting an existing one in place. Skipping paths that already
// exist in the backup bucket is therefore safe, not a staleness risk, and
// keeps each run's work down to only what's new since the last one.
//
// Real, disclosed limitation: this backs up within the same Supabase
// project, not to a genuinely separate provider/account. It protects
// against accidental deletion/overwrite and RLS/policy mistakes in the live
// bucket, but not against total loss of the Supabase project itself. True
// off-project replication (e.g. to S3/R2) would need real external
// credentials provisioned and added as secrets first -- out of scope here.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET_PAIRS = [
  ['avatar-photos', 'avatar-photos-backup'],
  ['ingredient-photos', 'ingredient-photos-backup'],
  ['inventory-photos', 'inventory-photos-backup'],
  ['item-photos', 'item-photos-backup'],
  ['location-photos', 'location-photos-backup'],
  ['memory-photos', 'memory-photos-backup'],
  ['recipe-photos', 'recipe-photos-backup'],
] as const;

const MAX_DEPTH = 6; // these buckets are 1-2 levels deep by convention; a hard ceiling just guards against a surprise structure looping forever.

async function listAllPaths(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix = '',
  depth = 0
): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const paths: string[] = [];
  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // A folder, not a file -- recurse into it.
      paths.push(...(await listAllPaths(supabase, bucket, fullPath, depth + 1)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const results: { bucket: string; copied: number; skipped: number; failed: number }[] = [];

  for (const [source, backup] of BUCKET_PAIRS) {
    let copied = 0;
    let skipped = 0;
    let failed = 0;

    const sourcePaths = await listAllPaths(supabase, source);
    const backupPaths = new Set(await listAllPaths(supabase, backup));

    for (const path of sourcePaths) {
      if (backupPaths.has(path)) {
        skipped++;
        continue;
      }
      try {
        const { data: fileData, error: downloadError } = await supabase.storage.from(source).download(path);
        if (downloadError || !fileData) throw downloadError ?? new Error('empty download');

        const { error: uploadError } = await supabase.storage
          .from(backup)
          .upload(path, fileData, { upsert: false });
        if (uploadError) throw uploadError;

        copied++;
      } catch (err) {
        console.error(`storage-backup: failed to back up ${source}/${path}:`, err);
        failed++;
      }
    }

    results.push({ bucket: source, copied, skipped, failed });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
