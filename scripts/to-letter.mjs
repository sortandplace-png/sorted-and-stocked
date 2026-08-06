#!/usr/bin/env node
// scripts/to-letter.mjs
// Turn a generator JPEG into a true 300 dpi US Letter print PDF.
//
// A Node port of to_letter.py, because no Python is installed in this
// environment while sharp (libvips) already is. The METHOD is the same:
// upscale to full Letter height with Lanczos, pad the width out, mild
// unsharp, embed at exactly 300 dpi.
//
// WHY THE PORT EXISTS AT ALL: the generator returns 896x1200 no matter
// what size the prompt asks for. Three separate size specs were ignored
// (2550x3300 twice, 1360x1760 once), so the fix happens in post rather
// than in the prompt.
//
// ONE DELIBERATE DEVIATION FROM to_letter.py: it MIRROR pads the margin;
// this EDGE REPLICATES instead (sharp's extendWith: 'copy').
// Mirroring reflects CONTENT, and on the pin pipeline it reproduced the
// Sort + Place wordmark upside down in the new margin. That is a recorded
// incident, not a hypothetical. Edge replication extends the outermost
// column of pixels, which on these assets is flat linen, so the seam is
// invisible and nothing can be reflected into view. For a 43px margin the
// two are visually identical when the edge is flat, and only edge
// replication is safe when it is not.
//
// Output is a PDF whose page is EXACTLY 612x792 pt (8.5x11in at 72pt/in),
// with a 2550x3300 image drawn to fill it, which is 300 dpi.
//
// Usage:  node scripts/to-letter.mjs input.jpg output.pdf
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const DPI = 300;
const LETTER_W = 8.5 * DPI; // 2550
const LETTER_H = 11 * DPI; // 3300
const PT_W = 612;
const PT_H = 792;

export async function toLetter(srcPath, outPath) {
  const src = sharp(srcPath);
  const { width: w0, height: h0 } = await src.metadata();
  if (!w0 || !h0) throw new Error(`to-letter: cannot read dimensions of ${srcPath}`);

  // 1. Scale to full Letter HEIGHT. Width follows the source aspect.
  const scale = LETTER_H / h0;
  const newW = Math.round(w0 * scale);

  let pipeline = sharp(srcPath).resize({
    width: newW,
    height: LETTER_H,
    kernel: sharp.kernel.lanczos3,
    fit: 'fill',
  });

  let note;
  if (newW < LETTER_W) {
    const pad = LETTER_W - newW;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    // EDGE REPLICATE, never mirror, never crop. See the header.
    pipeline = pipeline.extend({ top: 0, bottom: 0, left, right, extendWith: 'copy' });
    note = `edge-padded ${pad}px of width (${(pad / 2 / DPI).toFixed(2)}in each side)`;
  } else if (newW > LETTER_W) {
    const off = Math.floor((newW - LETTER_W) / 2);
    pipeline = pipeline.extract({ left: off, top: 0, width: LETTER_W, height: LETTER_H });
    note = `centre-cropped ${newW - LETTER_W}px of width`;
  } else {
    note = 'exact fit, no padding';
  }

  // 3. Restore the edge definition Lanczos softens.
  const jpeg = await pipeline
    .sharpen({ sigma: 1.6, m1: 0, m2: 3 })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();

  // 4. Embed in a page that is EXACTLY Letter in points. The image is
  // 2550x3300 drawn into 612x792pt, which is 300 dpi by definition.
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PT_W, PT_H]);
  const embedded = await pdf.embedJpg(jpeg);
  page.drawImage(embedded, { x: 0, y: 0, width: PT_W, height: PT_H });
  await writeFile(outPath, await pdf.save());

  const meta = await sharp(jpeg).metadata();
  return { px: [meta.width, meta.height], pt: [PT_W, PT_H], note };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain && process.argv[2] && process.argv[3]) {
  const r = await toLetter(process.argv[2], process.argv[3]);
  console.log(`${process.argv[3]}: ${r.px[0]}x${r.px[1]}px at ${DPI} dpi, page ${r.pt[0]}x${r.pt[1]}pt, ${r.note}`);
}
