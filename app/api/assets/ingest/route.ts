// app/api/assets/ingest/route.ts
// Server-side ingestion of Racquel's generated asset library (the 143.9MB
// link-shared Drive zip, 2 Aug). Runs HERE because production is the only
// place with all three: the service-role key, unrestricted egress to
// Drive, and clean binary handling (see migration 175's header for why the
// Code container can do none of it).
//
// AUTH: no session and no new secret. The caller presents a jobId; the
// route acts only when that uuid names a QUEUED, FRESH row in
// asset_ingest_jobs -- a table with RLS and zero policies, writable only
// via service role / direct SQL. Possession of a valid jobId proves the
// request originated database-side (pg_net). Every response is JSON.
//
// MODES
//  scan   -- READ-ONLY. Range-fetches the zip's central directory (~66KB,
//            Drive honors Range: verified 206) and stores the entry
//            listing in the job row. The mapping-first rule holds: nothing
//            is uploaded or updated by a scan.
//  ingest -- writes ONLY the files named in payload.files (built after
//            Racquel's mapping eyeball). Per file: Range-fetch just that
//            entry's compressed span, inflate, upload via service role,
//            update the target row. Batched small to fit serverless
//            duration limits; the SQL side loops batches.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const maxDuration = 60;

// The original 143.9MB library zip stays the default; a scan job may name
// a DIFFERENT zip via payload.zipUrl (origin-allowlisted below) -- added
// 3 Aug to identify anonymous drops like "download (11).zip" without
// pulling 119MB anywhere: the central directory alone says what's inside.
const DEFAULT_ZIP_URL =
  'https://drive.usercontent.google.com/download?id=1RSR2iDlOaImp3MAbsOuDIBf-fVipCWkJ&export=download&confirm=t';

// Shared by fetch-url mode and scan-mode zipUrl validation: this must
// never become an arbitrary-URL SSRF primitive.
const ALLOWED_ORIGINS = ['https://app.sortandplace.com', 'https://sortandplace.com', 'https://drive.usercontent.google.com'];
const PROJECT_PUBLIC = 'https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public';
const MAX_FILES_PER_CALL = 4;

type ZipEntry = {
  name: string;
  size: number;
  compressed: number;
  method: number;
  headerOffset: number;
  utf8Flag: boolean;
};

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
}

async function fetchRange(zipUrl: string, start: number | null, endOrSuffix: number): Promise<{ bytes: Uint8Array; total: number }> {
  // start=null means suffix range (last N bytes).
  const range = start === null ? `bytes=-${endOrSuffix}` : `bytes=${start}-${endOrSuffix}`;
  const res = await fetch(zipUrl, { headers: { Range: range }, redirect: 'follow' });
  if (res.status !== 206) throw new Error(`Drive range fetch returned ${res.status} (want 206)`);
  const contentRange = res.headers.get('content-range') ?? '';
  const total = Number(contentRange.split('/')[1] ?? 0);
  return { bytes: new Uint8Array(await res.arrayBuffer()), total };
}

function parseCentralDirectory(tail: Uint8Array, tailStartAbs: number): ZipEntry[] {
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD not found in tail -- fetch a larger suffix');
  const count = u16(tail, eocd + 10);
  const cdOffsetAbs = u32(tail, eocd + 16);
  let off = cdOffsetAbs - tailStartAbs;
  if (off < 0) throw new Error('central directory starts before the fetched tail -- fetch a larger suffix');
  const entries: ZipEntry[] = [];
  const strict = new TextDecoder('utf-8', { fatal: true });
  for (let n = 0; n < count; n++) {
    if (!(tail[off] === 0x50 && tail[off + 1] === 0x4b && tail[off + 2] === 0x01 && tail[off + 3] === 0x02)) {
      throw new Error(`central directory signature missing at entry ${n}`);
    }
    const flags = u16(tail, off + 8);
    const method = u16(tail, off + 10);
    const compressed = u32(tail, off + 20);
    const size = u32(tail, off + 24);
    const nameLen = u16(tail, off + 28);
    const extraLen = u16(tail, off + 30);
    const commentLen = u16(tail, off + 32);
    const headerOffset = u32(tail, off + 42);
    const nameBytes = tail.subarray(off + 46, off + 46 + nameLen);
    let name: string;
    let utf8Flag = (flags & 0x800) !== 0;
    try {
      name = strict.decode(nameBytes);
    } catch {
      // cp437-ish fallback: byte-to-charcode keeps it legible and flags it
      // for manual review instead of corrupting a storage path silently
      // (the #U2026 ellipsis warning from the directive).
      name = Array.from(nameBytes, (c) => String.fromCharCode(c)).join('');
      utf8Flag = false;
    }
    entries.push({ name, size, compressed, method, headerOffset, utf8Flag });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function fetchEntryBytes(zipUrl: string, entry: ZipEntry): Promise<Buffer> {
  // Local header is 30 bytes + name + extra (extra can differ from the
  // central record); pad generously, then compute the exact data start.
  const padded = 30 + 4096 + entry.compressed;
  const { bytes } = await fetchRange(zipUrl, entry.headerOffset, entry.headerOffset + padded - 1);
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error(`local header signature missing for ${entry.name}`);
  }
  const nameLen = u16(bytes, 26);
  const extraLen = u16(bytes, 28);
  const dataStart = 30 + nameLen + extraLen;
  const comp = bytes.subarray(dataStart, dataStart + entry.compressed);
  if (comp.length < entry.compressed) throw new Error(`short read for ${entry.name}`);
  if (entry.method === 0) return Buffer.from(comp);
  if (entry.method === 8) return inflateRawSync(Buffer.from(comp));
  throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
}

/** Storage-safe object name: ASCII word chars, dot, dash only. */
function safeName(name: string): string {
  const base = name.split('/').pop() ?? name;
  return base.replace(/…/g, '_').replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    ({ jobId } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }
  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin.from('asset_ingest_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job || job.status !== 'queued') {
    return NextResponse.json({ error: 'No such queued job' }, { status: 403 });
  }
  if (Date.now() - new Date(job.created_at).getTime() > 10 * 60 * 1000) {
    await admin.from('asset_ingest_jobs').update({ status: 'error', error: 'stale' }).eq('id', jobId);
    return NextResponse.json({ error: 'Job stale' }, { status: 403 });
  }
  await admin.from('asset_ingest_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', jobId);

  try {
    if (job.mode === 'scan') {
      const scanPayload = (job.payload ?? {}) as { zipUrl?: string };
      const zipUrl = scanPayload.zipUrl ?? DEFAULT_ZIP_URL;
      if (!ALLOWED_ORIGINS.includes(new URL(zipUrl).origin)) {
        throw new Error(`zipUrl origin not allowed: ${new URL(zipUrl).origin}`);
      }
      const { bytes: tail, total } = await fetchRange(zipUrl, null, 66000);
      const tailStartAbs = total - tail.length;
      const entries = parseCentralDirectory(tail, tailStartAbs);
      // zipUrl recorded so a later ingest job pulls entries from the SAME
      // zip the scan described, not the default.
      const result = { zipUrl, zipBytes: total, entryCount: entries.length, entries };
      await admin
        .from('asset_ingest_jobs')
        .update({ status: 'done', result, finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, entryCount: entries.length });
    }

    if (job.mode === 'thumb') {
      // Pixel VERIFICATION channel (3 Aug): the Code container has no
      // egress to storage or Drive, so before this mode existed nothing
      // could actually LOOK at an image that only exists production-side
      // -- transport checks passed while defective pixels shipped twice
      // (legacy-03, the first pyramid render). This returns a small
      // resized JPEG as base64 IN THE JOB ROW, where database-side SQL
      // can read it out and the container can decode and view it.
      // Same jobId auth as everything else; read-only against storage.
      const tp = (job.payload ?? {}) as { bucket?: string; path?: string; width?: number };
      if (!tp.bucket || !tp.path) throw new Error('payload needs bucket + path');
      const width = Math.min(Math.max(tp.width ?? 480, 64), 1024);
      const { data: blob, error: dlErr } = await admin.storage.from(tp.bucket).download(tp.path);
      if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? 'no data'}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const thumb = await sharp(buf).resize({ width }).jpeg({ quality: 72 }).toBuffer();
      const result = {
        source: `${tp.bucket}/${tp.path}`,
        sourceBytes: buf.length,
        width,
        thumbBase64: thumb.toString('base64'),
      };
      await admin
        .from('asset_ingest_jobs')
        .update({ status: 'done', result, finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, thumbBytes: thumb.length });
    }

    if (job.mode === 'register-export') {
      // SS-092/SS-438: the register is the ONE artefact this project cannot
      // reconstruct -- everything else is derivable from the app. Until
      // this mode existed it had no copy anywhere off the database, and
      // SS-001 records 240 rows deleted in two unattributed bulk events
      // whose evidence was gone before anyone looked (24h log retention).
      //
      // Postgres -> file, with NO model in the path (the SS-438 rule): the
      // rows go straight from the query into .md and .csv bytes here and
      // into a PRIVATE storage bucket. Nothing summarises at any stage,
      // which is the only basis on which the word "complete" is true.
      // Called daily by pg_cron; the row count and md5 come back in the
      // job result so a silent partial write is detectable.
      const { data: rows, error: rErr } = await admin
        .from('work_items')
        .select('*')
        .order('id');
      if (rErr) throw new Error(`work_items read: ${rErr.message}`);
      const items = rows ?? [];
      if (items.length === 0) throw new Error('refusing to write an empty export');

      // SS-100 sorts after SS-99: numeric on the suffix, never lexicographic.
      const num = (id: string) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
      items.sort((a, b) => num(a.id) - num(b.id));

      const cols = Object.keys(items[0]);
      const csvCell = (v: unknown) =>
        v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...items.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');

      const md = [
        `# Sorted & Stocked work register`,
        ``,
        `${items.length} rows, exported ${new Date().toISOString()}.`,
        `Direct from Postgres, nothing summarised. The table remains the source of truth;`,
        `this file is a snapshot and goes stale the moment anything is written to work_items.`,
        ``,
        ...items.flatMap((r) => [
          `---`,
          ``,
          `## ${r.id} — ${r.title ?? ''}`,
          ``,
          `- status: ${r.status ?? ''} · evidence: ${r.evidence ?? ''} · owner: ${r.owner ?? ''}`,
          `- sent to Code: ${r.sent_to_code_at ?? ''} · Code reported: ${r.code_reported_at ?? ''}`,
          `- verified: ${r.verified_at ?? ''} ${r.verified_how ? `(${r.verified_how})` : ''}`,
          r.superseded_by ? `- superseded by: ${r.superseded_by}` : '',
          ``,
          r.detail ?? '',
          ``,
        ]),
      ].join('\n');

      // SS-208 audit: harmless. Internal asset-tooling filename/log stamp,
      // not user-facing data -- a UTC-vs-Eastern off-by-one changes only
      // what a generated filename looks like, never what it does.
      const stamp = new Date().toISOString().slice(0, 10);
      const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
      const written: { path: string; bytes: number; md5: string }[] = [];
      for (const [name, body, type] of [
        [`work_items-${stamp}.md`, md, 'text/markdown'],
        [`work_items-${stamp}.csv`, csv, 'text/csv'],
        // latest.* overwrites daily so there is always one stable path to
        // grab without knowing today's date; the dated copies accumulate.
        [`work_items-latest.md`, md, 'text/markdown'],
        [`work_items-latest.csv`, csv, 'text/csv'],
      ] as const) {
        const buf = Buffer.from(body, 'utf8');
        const { error: upErr } = await admin.storage
          .from('backups')
          .upload(`register/${name}`, buf, { contentType: type, upsert: true });
        if (upErr) throw new Error(`upload ${name}: ${upErr.message}`);
        written.push({ path: `backups/register/${name}`, bytes: buf.length, md5: md5(body) });
      }

      const result = { rows: items.length, detailChars: items.reduce((n, r) => n + (r.detail?.length ?? 0), 0), written };
      await admin
        .from('asset_ingest_jobs')
        .update({ status: 'done', result, finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (job.mode === 'fetch-url') {
      // Copy files the deployment can reach into storage -- built for the
      // blog featured images (staged in this repo's public/ so production
      // serves them, then copied to the marketing bucket to match the
      // seven live posts' URL convention). STRICT origin allowlist: this
      // must never become an arbitrary-URL SSRF/upload primitive.
      const payload = (job.payload ?? {}) as {
        files?: { url: string; bucket: string; path: string; contentType: string }[];
      };
      if (!payload.files?.length) throw new Error('payload needs files');
      if (payload.files.length > MAX_FILES_PER_CALL) throw new Error(`max ${MAX_FILES_PER_CALL} files per job`);
      const results: { path: string; ok: boolean; detail: string }[] = [];
      for (const f of payload.files) {
        try {
          const origin = new URL(f.url).origin;
          if (!ALLOWED_ORIGINS.includes(origin)) throw new Error(`origin not allowed: ${origin}`);
          const res = await fetch(f.url, { redirect: 'follow' });
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const data = Buffer.from(await res.arrayBuffer());
          if (data.length < 1000) throw new Error(`suspiciously small (${data.length}B)`);
          const { error: upErr } = await admin.storage
            .from(f.bucket)
            .upload(f.path, data, { contentType: f.contentType, upsert: true });
          if (upErr) throw new Error(`upload: ${upErr.message}`);
          results.push({ path: `${f.bucket}/${f.path}`, ok: true, detail: `${data.length} bytes` });
        } catch (e) {
          results.push({ path: `${f.bucket}/${f.path}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
        }
      }
      await admin
        .from('asset_ingest_jobs')
        .update({ status: 'done', result: { results }, finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, results });
    }

    // mode === 'ingest'
    const payload = (job.payload ?? {}) as {
      scanJobId?: string;
      files?: { name: string; kind: 'sop-image' | 'clip' | 'storage'; target: string }[];
    };
    if (!payload.scanJobId || !payload.files?.length) {
      throw new Error('payload needs scanJobId + files');
    }
    if (payload.files.length > MAX_FILES_PER_CALL) {
      throw new Error(`max ${MAX_FILES_PER_CALL} files per job -- batch the mapping`);
    }
    const { data: scanJob } = await admin
      .from('asset_ingest_jobs')
      .select('result')
      .eq('id', payload.scanJobId)
      .eq('mode', 'scan')
      .eq('status', 'done')
      .maybeSingle();
    const scanResult = scanJob?.result as { entries?: ZipEntry[]; zipUrl?: string } | null;
    const entries: ZipEntry[] = scanResult?.entries ?? [];
    const zipUrl = scanResult?.zipUrl ?? DEFAULT_ZIP_URL;
    if (!entries.length) throw new Error('scan job not found or empty');

    const results: { name: string; ok: boolean; detail: string }[] = [];
    for (const f of payload.files) {
      try {
        const entry = entries.find((e) => e.name === f.name);
        if (!entry) throw new Error('not in scan listing');
        const data = await fetchEntryBytes(zipUrl, entry);
        if (data.length !== entry.size) throw new Error(`inflated ${data.length} != expected ${entry.size}`);

        if (f.kind === 'storage') {
          // Generic extraction (3 Aug): pull a zip entry straight into a
          // bucket path with NO row write -- for assets that live in a
          // link-shared zip (e.g. the 159-image Pinterest library) and
          // are wanted individually. target = "bucket/path/inside".
          const slash = f.target.indexOf('/');
          if (slash < 1) throw new Error('storage target must be bucket/path');
          const bucket = f.target.slice(0, slash);
          const objectPath = f.target.slice(slash + 1);
          const ext = objectPath.split('.').pop()?.toLowerCase() ?? '';
          const contentType =
            ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const { error: upErr } = await admin.storage
            .from(bucket)
            .upload(objectPath, data, { contentType, upsert: true });
          if (upErr) throw new Error(`upload: ${upErr.message}`);
          results.push({ name: f.name, ok: true, detail: `${f.target} <- ${data.length} bytes` });
        } else if (f.kind === 'sop-image') {
          // target = sop_code, e.g. "SOP-099"
          const objectPath = `${f.target}_reference_${safeName(f.name)}`;
          const { error: upErr } = await admin.storage
            .from('sop-posters')
            .upload(objectPath, data, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw new Error(`upload: ${upErr.message}`);
          const url = `${PROJECT_PUBLIC}/sop-posters/${objectPath}`;
          const { error: rowErr } = await admin
            .from('sop_library')
            .update({ expected_appearance_url: url })
            .eq('sop_code', f.target);
          if (rowErr) throw new Error(`row: ${rowErr.message}`);
          results.push({ name: f.name, ok: true, detail: `${f.target} <- ${objectPath}` });
        } else {
          // target = training_videos slug, e.g. "sop-clip-sop-096".
          // R21: the OLD object stays in place; the row points at a new
          // versioned path. Poster cleared -- the replacement clip needs
          // its own frame (poster run still owed).
          const { data: row } = await admin
            .from('training_videos')
            .select('id, storage_path')
            .eq('slug', f.target)
            .maybeSingle();
          if (!row) throw new Error('no training_videos row');
          const objectPath = `sop-clips/replaced/${safeName(f.name)}`;
          const { error: upErr } = await admin.storage
            .from('training-videos')
            .upload(objectPath, data, { contentType: 'video/mp4', upsert: true });
          if (upErr) throw new Error(`upload: ${upErr.message}`);
          const { error: rowErr } = await admin
            .from('training_videos')
            .update({ storage_path: objectPath, replace_requested: false, poster_path: null })
            .eq('id', row.id);
          if (rowErr) throw new Error(`row: ${rowErr.message}`);
          results.push({ name: f.name, ok: true, detail: `${f.target}: ${row.storage_path} -> ${objectPath}` });
        }
      } catch (e) {
        results.push({ name: f.name, ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
    await admin
      .from('asset_ingest_jobs')
      .update({ status: 'done', result: { results }, finished_at: new Date().toISOString() })
      .eq('id', jobId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from('asset_ingest_jobs')
      .update({ status: 'error', error: msg, finished_at: new Date().toISOString() })
      .eq('id', jobId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
