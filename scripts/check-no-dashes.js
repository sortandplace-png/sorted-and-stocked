#!/usr/bin/env node
// scripts/check-no-dashes.js
// SS-666. Em and en dashes in reader-facing copy.
//
// WHY A SCRIPT: content sweeps cleaned 34 dashes out of the DATABASE on
// 3 Aug and could not touch the three that were in component SOURCE. One
// of those rendered on every marketing page, including every blog post,
// for as long as the footer has existed. A sweep that cannot reach the
// place the text lives will keep missing it, so the check has to run
// where the source is.
//
// WHY NOT ONLY STRING LITERALS: the footer dash was JSX TEXT, not a string
// literal. A check that looked only at quoted strings would have missed
// the exact bug it was written for. So: strip comments, then flag every
// remaining U+2014/U+2013. An em dash cannot legally appear anywhere else
// in a .ts/.tsx file except a string, a template literal or JSX text, all
// three of which are copy.
//
// TWO SCOPES, because the ruling has two halves:
//   MARKETING  -- absolute. Any dash fails, no baselining, no exceptions.
//                 These files are the public face of the practice.
//   APP        -- ratchet. The interior is exempt from the no-dash rule as
//                 it stands today, so its existing dashes are counted into
//                 a baseline and tolerated. Anything NEW fails.
//
// Wired into `prebuild`, so `npm run build` runs it. Same mechanism as
// scripts/check-test-data.js and scripts/check-desktop-layout.js.
//
// SS-765: THE COPY IS NOT IN THE REPO. The comment above says a sweep that
// cannot reach the place the text lives will keep missing it, and then this
// script did exactly that for the other direction: every blog post lives in
// blog_posts.body_markdown and blog_posts.faq_jsonld in Postgres, so nothing
// below the repo walk could ever see a single word of it. 149 spaced em
// dashes sat in structured data under an enforced rule and the check passed
// on every build. The DB half at the bottom of this file closes that, on the
// same absolute terms as marketing source: any dash fails, no baseline.
//
// It scans EVERY string value in each row rather than a named column list,
// so a copy column added tomorrow is covered without editing this file.
// Only ids, slugs, paths and URLs are skipped, and those cannot hold copy.
const fs = require('fs');
const path = require('path');

// lib/ is scanned too, though the ruling named app/ and components/: the
// SS-672 email copy lives in lib/subscribe-emails.ts, and an email is the
// most reader-facing surface there is. The rest of lib/ is baselined like
// the app interior.
const ROOTS = ['app', 'components', 'lib'];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

const EM = '—';
const EN = '–';

// Public marketing surfaces. A dash here fails the build outright, even on
// a file that has one today, because today there are none: this list was
// cleared to zero when the check went in and it stays at zero.
const MARKETING_PREFIXES = [
  'components/marketing/',
  'components/blog/',
  'app/blog/',
  'app/about/',
  'app/services/',
  'app/faq/',
  'app/contact/',
  'app/sitemap/',
  'app/page.tsx',
  // The two subscriber emails, EN and ES. SS-672 states it outright:
  // no dashes in either email's copy.
  'lib/subscribe-emails.ts',
];

const BASELINE_FILE = path.join(__dirname, 'no-dashes-baseline.json');

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(full, out);
    } else if (EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out // and /* *​/ comments, preserving line structure so reported
 * line numbers still match the file. Quote-aware, so a "//" inside a
 * string is not mistaken for a comment.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | line | block | single | double | tick
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") { state = 'single'; out += c; i++; continue; }
      if (c === '"') { state = 'double'; out += c; i++; continue; }
      if (c === '`') { state = 'tick'; out += c; i++; continue; }
      out += c; i++; continue;
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; i++; continue; }
      out += ' '; i++; continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' '; i++; continue;
    }

    // Inside a string: copy verbatim, honour backslash escapes.
    if (c === '\\') { out += c + (next ?? ''); i += 2; continue; }
    if (state === 'single' && c === "'") state = 'code';
    else if (state === 'double' && c === '"') state = 'code';
    else if (state === 'tick' && c === '`') state = 'code';
    out += c; i++;
  }
  return out;
}

function isMarketing(rel) {
  const norm = rel.split(path.sep).join('/');
  return MARKETING_PREFIXES.some((p) => (p.endsWith('/') ? norm.startsWith(p) : norm === p));
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(root, [])) {
    const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
    const stripped = stripComments(fs.readFileSync(file, 'utf8'));
    stripped.split('\n').forEach((line, idx) => {
      if (line.includes(EM) || line.includes(EN)) {
        findings.push({ rel, line: idx + 1, text: line.trim().slice(0, 120) });
      }
    });
  }
}

// --write-baseline regenerates the tolerated app-interior list. Run it
// deliberately, never to silence a new failure.
if (process.argv.includes('--write-baseline')) {
  const appOnly = findings.filter((f) => !isMarketing(f.rel));
  const counts = {};
  for (const f of appOnly) counts[f.rel] = (counts[f.rel] || 0) + 1;
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + '\n');
  console.log(`Wrote baseline: ${Object.keys(counts).length} file(s), ${appOnly.length} occurrence(s).`);
  process.exit(0);
}

let baseline = {};
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

const marketingHits = findings.filter((f) => isMarketing(f.rel));

// Ratchet by COUNT PER FILE, not by filename: a baselined file may keep the
// dashes it had and may not gain one more.
const perFile = {};
for (const f of findings) {
  if (isMarketing(f.rel)) continue;
  (perFile[f.rel] = perFile[f.rel] || []).push(f);
}
const appRegressions = [];
for (const [rel, hits] of Object.entries(perFile)) {
  const allowed = baseline[rel] ?? 0;
  if (hits.length > allowed) appRegressions.push({ rel, allowed, found: hits.length, hits });
}

// --- SS-765: the database half -------------------------------------------
// Reader-facing rows. `skip` is the deny-list of columns that cannot hold
// copy (ids, slugs, paths, URLs, the search vector). Everything else in the
// row is treated as copy, including columns nobody has added yet.
const DB_TABLES = [
  {
    table: 'blog_posts',
    label: 'slug',
    skip: ['slug', 'header_image_url', 'cta_url', 'search_tsv'],
  },
  { table: 'blog_categories', label: 'slug', skip: ['id', 'slug'] },
  { table: 'printables', label: 'slug', skip: ['id', 'slug', 'pdf_path', 'cover_image_url'] },
];

function readEnv() {
  const out = {};
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].trim();
    }
  }
  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (process.env[k]) out[k] = process.env[k];
  }
  return out;
}

// Walk any JSON value and report the dot/bracket path of every string that
// carries a dash. jsonb columns are walked too, which is where the 149 were.
function scanValue(value, trail, hits) {
  if (typeof value === 'string') {
    if (value.includes(EM) || value.includes(EN)) {
      const at = Math.max(value.indexOf(EM), value.indexOf(EN));
      hits.push({ path: trail, text: value.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ') });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanValue(v, `${trail}[${i}]`, hits));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scanValue(v, trail ? `${trail}.${k}` : k, hits);
  }
}

async function checkDatabase() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  // Same posture as check-printables.js: a build with no service key cannot
  // ask the question and must not fail for that reason. It must also not
  // report a pass it did not earn, hence the explicit NOT VERIFIED line.
  if (!url || !key) {
    console.warn('⚠ SS-765 dash check: no Supabase credentials, DATABASE COPY NOT VERIFIED');
    return { hits: [], verified: [] };
  }

  const verified = [];
  const dbHits = [];
  for (const spec of DB_TABLES) {
    let rows;
    try {
      const res = await fetch(`${url}/rest/v1/${spec.table}?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        console.warn(`⚠ SS-765 dash check: ${spec.table} unreadable (HTTP ${res.status}), NOT VERIFIED`);
        continue;
      }
      rows = await res.json();
    } catch (err) {
      console.warn(`⚠ SS-765 dash check: ${spec.table} unreachable, NOT VERIFIED:`, err.message);
      continue;
    }

    verified.push(`${spec.table} (${rows.length})`);
    for (const row of rows) {
      const who = row[spec.label] ?? '(unlabelled row)';
      for (const [col, val] of Object.entries(row)) {
        if (spec.skip.includes(col)) continue;
        const hits = [];
        scanValue(val, '', hits);
        for (const h of hits) {
          dbHits.push({ table: spec.table, who, col, path: h.path, text: h.text });
        }
      }
    }
  }
  return { hits: dbHits, verified };
}

(async () => {
const db = await checkDatabase();
const dbHits = db.hits;

let failed = false;

if (dbHits.length > 0) {
  failed = true;
  console.error('\n✘ SS-765: em or en dash in database copy.\n');
  console.error('  This text renders on a public page. It is not in the repo, so');
  console.error('  neither a repo grep nor the walk above can see it: fix it with an');
  console.error('  UPDATE against the row, not with an edit to a file.\n');
  for (const h of dbHits) {
    console.error(`  ${h.table}[${h.who}].${h.col}${h.path ? ' ' + h.path : ''}\n    ...${h.text}...`);
  }
  console.error('');
}

if (marketingHits.length > 0) {
  failed = true;
  console.error('\n✘ SS-666: em or en dash in marketing copy.\n');
  console.error('  Marketing copy takes a full stop, not a dash. This scope is');
  console.error('  absolute: there is no baseline and nothing to add a file to.');
  console.error('  A content sweep cannot reach component source, which is why');
  console.error('  the footer shipped one on every page for months.\n');
  for (const f of marketingHits) console.error(`  ${f.rel}:${f.line}\n    ${f.text}`);
  console.error('');
}

if (appRegressions.length > 0) {
  failed = true;
  console.error('\n✘ SS-666: NEW em or en dash in app copy.\n');
  console.error('  The app interior is exempt for what it already had, not for');
  console.error('  anything added since. Use a full stop, or a colon.\n');
  for (const r of appRegressions) {
    console.error(`  ${r.rel}  (baseline ${r.allowed}, found ${r.found})`);
    for (const h of r.hits) console.error(`    :${h.line}  ${h.text}`);
  }
  console.error('');
}

if (failed) process.exit(1);

const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `✓ SS-666 dash check: marketing copy clean` +
    (baselineTotal ? ` (${baselineTotal} baselined app-interior occurrence(s))` : '')
);
// Never claim a pass for a table that was not read. A skipped table is
// reported as skipped, in the same breath as the ones that did pass.
const skipped = DB_TABLES.map((t) => t.table).filter(
  (t) => !db.verified.some((v) => v.startsWith(t + ' '))
);
console.log(
  db.verified.length
    ? `✓ SS-765 dash check: database copy clean in ${db.verified.join(', ')}` +
        (skipped.length ? `  [NOT VERIFIED: ${skipped.join(', ')}]` : '')
    : `⚠ SS-765 dash check: database copy NOT VERIFIED (${skipped.join(', ')})`
);
})();
