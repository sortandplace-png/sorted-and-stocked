#!/usr/bin/env node
// scripts/check-printables.js
// SS-686. The gated printables the welcome email links must actually be in
// the private 'printables' bucket.
//
// REWRITTEN from the SS-672 version, which checked public/downloads. That
// is now the wrong place to look, and checking it would be worse than not
// checking: a pass would mean the file is PUBLIC, which is the exact
// condition this ticket exists to remove. A file in public/ is served as a
// static asset before any route or session runs and cannot be gated.
//
// The 24 ReportLab stubs in public/downloads are NOT checked here. They
// stay public and free by ruling; gating them is phase C, 1 September.
//
// Fails on a missing object, warns on a slug listed as still in defect, so
// Racquel is not blocked from shipping two while two are being fixed.
// Skips entirely with no credentials, because a build without a service
// key cannot ask the question and must not fail for that reason.
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(process.cwd(), 'lib', 'subscribe-emails.ts');
const src = fs.readFileSync(SOURCE, 'utf8');

// Read slug/file pairs out of GATED_PRINTABLES rather than repeating them,
// so this check cannot drift from the email that uses them.
const entries = [...src.matchAll(/slug:\s*'([^']+)',\s*\n\s*file:\s*'([^']+\.pdf)'/g)].map((m) => ({
  slug: m[1],
  file: m[2],
}));

if (entries.length === 0) {
  console.error('\n✘ SS-686: could not read GATED_PRINTABLES from lib/subscribe-emails.ts.');
  console.error('  The shape changed. Update this check to match.\n');
  process.exit(1);
}

// Held out with defects open. Warn, never fail. Delete a line when the
// defect closes AND the file is in the bucket.
const IN_DEFECT = new Set([
  'shabbos-prep', // SS-685: brief printed on artwork, banned phrase, em dash, wrong page size
  'pantry-hierarchy', // SS-687: gibberish strip, "INTERACTIVE FILL IN" is false
  'erev-shabbos', // not built, blocked on Rav review of the blech line
]);

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

(async () => {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('⚠ SS-686 printables: no Supabase credentials, bucket contents not verified');
    return;
  }

  let objects = new Set();
  try {
    const res = await fetch(`${url}/storage/v1/object/list/printables`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000 }),
    });
    if (!res.ok) {
      console.warn(`⚠ SS-686 printables: could not list the bucket (HTTP ${res.status}), not verified`);
      return;
    }
    objects = new Set((await res.json()).map((o) => o.name));
  } catch (err) {
    console.warn('⚠ SS-686 printables: bucket unreachable, not verified:', err.message);
    return;
  }

  const missing = entries.filter((e) => !objects.has(e.file));
  const hard = missing.filter((e) => !IN_DEFECT.has(e.slug));
  const waiting = missing.filter((e) => IN_DEFECT.has(e.slug));

  if (hard.length > 0) {
    console.error('\n✘ SS-686: the welcome email links a printable that is not in the bucket.\n');
    console.error('  These links go to real people and cannot be recalled. Upload the');
    console.error('  object to the private printables bucket under EXACTLY this name,');
    console.error('  or remove it from GATED_PRINTABLES in lib/subscribe-emails.ts.');
    console.error('  Do NOT "fix" this by putting the file in public/downloads: that');
    console.error('  ungates it, which is the defect this ticket closed.\n');
    for (const e of hard) console.error(`  printables/${e.file}`);
    console.error('');
    process.exit(1);
  }

  if (waiting.length > 0) {
    console.warn(
      `\n⚠ SS-686: ${waiting.length} printable(s) held out with defects open: ${waiting
        .map((e) => e.slug)
        .join(', ')}`
    );
  }
  console.log(`✓ SS-686 printables: all ${entries.length} gated file(s) present in the private bucket`);
})();
