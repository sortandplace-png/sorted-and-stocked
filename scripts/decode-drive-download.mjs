#!/usr/bin/env node
// scripts/decode-drive-download.mjs
// SS asset pipeline. The Drive MCP's download_file_content tool returns
// its {content, id, mimeType, title} payload as base64 -- but for any
// real image it's large enough that the harness saves it to a
// tool-result JSON file on disk instead of returning it inline. This
// decodes that saved JSON's base64 `content` field back into the real
// binary and writes it under .asset-match/assets/, named by the file's
// own `title` (the original Drive filename) so match-assets.mjs's
// existing basename-matching logic finds it with zero changes.
//
// Usage: node scripts/decode-drive-download.mjs <tool-result-json-path>
import fs from 'node:fs';
import path from 'node:path';

const SCRATCH = process.env.SCRATCH || path.join(process.cwd(), '.asset-match');
const ASSETS = path.join(SCRATCH, 'assets');

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/decode-drive-download.mjs <tool-result-json-path>');
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, '');
const parsed = JSON.parse(raw);
const { content, title, mimeType } = parsed;
if (!content || !title) {
  console.error('Missing content or title in the tool-result JSON.');
  process.exit(1);
}

fs.mkdirSync(ASSETS, { recursive: true });
const outPath = path.join(ASSETS, title);
fs.writeFileSync(outPath, Buffer.from(content, 'base64'));
console.log(`wrote ${outPath}  (${mimeType}, ${fs.statSync(outPath).size} bytes)`);
