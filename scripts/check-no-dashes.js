#!/usr/bin/env node
// SS-666. Fails the build on an em dash (U+2014) or en dash (U+2013) in
// MARKETING copy. Runs from `prebuild`, so it gates every Vercel deploy.
//
// Why a check and not another sweep: content sweeps cleaned 34 dashes out
// of the DATABASE on 3 Aug and could not reach these, because these live in
// component source. Three were still rendering on every marketing page,
// including every blog post, a day later. A sweep fixes the instances; only
// a gate stops the next one.
//
// SCOPE IS DELIBERATELY NARROW. The app interior is EXEMPT from the no-dash
// rule -- 276 dashes across 84 interior files, which are staff-facing UI
// strings, not marketing copy. Failing on those would either break the
// build or force a meaningless 276-file rewrite. Only surfaces a member of
// the public reads are listed here. ADD A PATH WHEN YOU ADD A PUBLIC PAGE.
//
// Comments are excluded, deliberately: the house style uses "--" in prose
// comments and an em dash occasionally appears in quoted rulings. What
// ships to a reader is the thing under rule.
//
// NOTE this catches JSX TEXT as well as quoted string literals, and it has
// to: the footer instance that prompted SS-666 was JSX text, not a literal,
// so a literals-only check would have missed the very defect it exists for.
const fs = require('fs');
const path = require('path');

const ROOTS = [
  'components/marketing',
  'components/blog',
  'app/blog',
  'app/services',
  'app/about',
  'app/faq',
  'app/contact',
  'app/welcome',
  'app/sitemap',
];
const FILES = [
  'app/page.tsx',
  'components/ConsultationForm.tsx',
  'components/RequestAccessForm.tsx',
  'lib/simple-markdown.tsx',
];

const DASH = /[—–]/;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const targets = [...FILES.filter((f) => fs.existsSync(f))];
for (const r of ROOTS) walk(r, targets);

const failures = [];
for (const file of targets) {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (DASH.test(line)) failures.push({ file, line: i + 1, text: line.trim().slice(0, 120) });
  });
}

if (failures.length > 0) {
  console.error('\n  MARKETING COPY CONTAINS AN EM DASH OR EN DASH (SS-666)\n');
  for (const f of failures) console.error(`  ${f.file}:${f.line}\n    ${f.text}\n`);
  console.error('  Replace with a full stop, or a comma, or rewrite the sentence.');
  console.error('  The app interior is exempt; these paths are public-facing copy.\n');
  process.exit(1);
}

console.log(`check-no-dashes: ${targets.length} marketing files clean`);
