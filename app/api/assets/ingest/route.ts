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

export const maxDuration = 60;

const ZIP_URL =
  'https://drive.usercontent.google.com/download?id=1RSR2iDlOaImp3MAbsOuDIBf-fVipCWkJ&export=download&confirm=t';
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

async function fetchRange(start: number | null, endOrSuffix: number): Promise<{ bytes: Uint8Array; total: number }> {
  // start=null means suffix range (last N bytes).
  const range = start === null ? `bytes=-${endOrSuffix}` : `bytes=${start}-${endOrSuffix}`;
  const res = await fetch(ZIP_URL, { headers: { Range: range }, redirect: 'follow' });
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

async function fetchEntryBytes(entry: ZipEntry): Promise<Buffer> {
  // Local header is 30 bytes + name + extra (extra can differ from the
  // central record); pad generously, then compute the exact data start.
  const padded = 30 + 4096 + entry.compressed;
  const { bytes } = await fetchRange(entry.headerOffset, entry.headerOffset + padded - 1);
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
      const { bytes: tail, total } = await fetchRange(null, 66000);
      const tailStartAbs = total - tail.length;
      const entries = parseCentralDirectory(tail, tailStartAbs);
      const result = { zipBytes: total, entryCount: entries.length, entries };
      await admin
        .from('asset_ingest_jobs')
        .update({ status: 'done', result, finished_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, entryCount: entries.length });
    }

    // mode === 'ingest'
    const payload = (job.payload ?? {}) as {
      scanJobId?: string;
      files?: { name: string; kind: 'sop-image' | 'clip'; target: string }[];
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
    const entries: ZipEntry[] = (scanJob?.result as { entries?: ZipEntry[] } | null)?.entries ?? [];
    if (!entries.length) throw new Error('scan job not found or empty');

    const results: { name: string; ok: boolean; detail: string }[] = [];
    for (const f of payload.files) {
      try {
        const entry = entries.find((e) => e.name === f.name);
        if (!entry) throw new Error('not in scan listing');
        const data = await fetchEntryBytes(entry);
        if (data.length !== entry.size) throw new Error(`inflated ${data.length} != expected ${entry.size}`);

        if (f.kind === 'sop-image') {
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
