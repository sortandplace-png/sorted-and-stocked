#!/usr/bin/env node
// scripts/upload-sop-posters.mjs
// One-time maintenance pass, not a migration (storage upload + data write
// against sop_library.expected_appearance_url).
//
// Racquel: "Take sop-image-map.csv. Upload each file to the sop-posters
// bucket, write the public URL into sop_library.expected_appearance_url
// matched on sop_code. 52 rows, one-to-one, no guessing required. Do not
// match on the number in any Drive filename -- two numbering schemes
// exist and they disagree. This map is already resolved by subject."
//
// So this script does NOT compute a match -- it trusts the CSV's sop_code
// -> file mapping verbatim and just executes it: upload, then write the
// URL. The CSV's `file` column can contain the literal text "#U2026" in
// place of the real U+2026 ellipsis the Drive generator truncates long
// names with (a CSV-export encoding artifact) -- swapped back to the real
// character before looking the file up on disk, since that's how the
// extracted zip actually named it.
//
// sop-posters is a PRIVATE bucket (SS-363) -- expected_appearance_url is
// still stored in the "public"-shaped URL form as a path-carrying
// convention (see lib/storage-image.ts's storagePathFromPublicUrl), so
// that's the form written here, matching every existing populated row.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CSV_PATH = process.argv[2] || 'C:\\Users\\rockl\\Downloads\\sop-image-map.csv';
const IMAGES_DIR = process.argv[3] || path.join(process.cwd(), '.asset-match', 'sop-posters');
const BUCKET = 'sop-posters';
const APPLY = process.argv.includes('--apply');

// Minimal CSV parser: three columns (sop_code, task_en, file), task_en may
// be quoted and may contain a comma -- handles just that shape, not general CSV.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [, ...rows] = lines; // drop header
  return rows.map((line) => {
    const m = line.match(/^([^,]+),(?:"([^"]*)"|([^,]*)),(.+)$/);
    if (!m) throw new Error(`Unparseable CSV row: ${line}`);
    const [, sop_code, quoted, unquoted, file] = m;
    return { sop_code, task_en: quoted ?? unquoted, file: file.replace(/^"|"$/g, '').replace(/#U2026/g, '\u2026') };
  });
}

const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
console.log(`${rows.length} rows in CSV. MODE: ${APPLY ? 'apply' : 'dry run (pass --apply to write)'}\n`);

let uploaded = 0;
let updated = 0;
let missing = 0;
let failed = 0;

for (const row of rows) {
  const src = path.join(IMAGES_DIR, row.file);
  if (!fs.existsSync(src)) {
    console.error(`  MISSING FILE  ${row.sop_code}  ${row.file}`);
    missing++;
    continue;
  }
  if (!APPLY) {
    console.log(`  would upload+link  ${row.sop_code}  <- ${row.file}`);
    continue;
  }
  // Storage keys reject the raw U+2026 ellipsis ("Invalid key") -- ASCII-only
  // storage key for those, DB URL still points at whatever key was actually
  // uploaded so the two never drift apart.
  const storageKey = row.file.replace(/…/g, '');
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
  const bytes = fs.readFileSync(src);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, bytes, { contentType: 'image/jpeg', upsert: true });
  if (upErr) {
    console.error(`  UPLOAD FAILED  ${row.sop_code}  ${row.file}: ${upErr.message}`);
    failed++;
    continue;
  }
  uploaded++;
  // supabase-js does not reliably populate `count` on update().select() in
  // this configuration -- checked live: `data` correctly holds the updated
  // row while `count` came back null on a real, successful update. Check
  // data.length instead, not count.
  const { data: updData, error: updErr } = await supabase
    .from('sop_library')
    .update({ expected_appearance_url: storageUrl })
    .eq('sop_code', row.sop_code)
    .select('sop_code');
  if (updErr) {
    console.error(`  DB UPDATE FAILED  ${row.sop_code}: ${updErr.message}`);
    failed++;
    continue;
  }
  if (!updData || updData.length === 0) {
    console.error(`  NO MATCHING sop_library ROW  ${row.sop_code}`);
    failed++;
    continue;
  }
  updated++;
  console.log(`  done  ${row.sop_code}  ${storageKey}`);
}

console.log(`\nuploaded ${uploaded}, db rows updated ${updated}, missing files ${missing}, failed ${failed}`);
