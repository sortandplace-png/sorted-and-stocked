#!/usr/bin/env node
// scripts/build-printable-pdf.mjs
// SS-833. Printables are printed, not viewed on a phone -- every printable
// must be a true US Letter portrait PDF at print resolution, built as a
// document (page size + embedded image), never left as a bare graphic.
//
// Letter portrait at 300dpi print resolution: 2550x3300px, 612x792pt.
// Source artwork (896x1200, aspect 0.747) is close to Letter's aspect
// (0.773) but not identical -- fit-inside plus linen padding rather than
// cropping, so nothing on an informational sheet gets cut off to force
// an exact match. Padding color is the brand's own linen ground (#FFFAF3,
// design_rules D-06/D-17), not white, so the page background matches the
// artwork's own background rather than seaming against it.
//
// Usage: node scripts/build-printable-pdf.mjs <source.jpg> <slug>
// Writes public/downloads/<slug>.pdf and public/images/<slug>-cover.webp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const LETTER_PT = { width: 612, height: 792 };
const PRINT_DPI = 300;
const LETTER_PX = { width: Math.round(8.5 * PRINT_DPI), height: Math.round(11 * PRINT_DPI) };
const LINEN = { r: 255, g: 250, b: 243 };

const [, , srcPath, slug] = process.argv;
if (!srcPath || !slug) {
  console.error('Usage: node scripts/build-printable-pdf.mjs <source.jpg> <slug>');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'public', 'downloads');
const imagesDir = path.join(process.cwd(), 'public', 'images');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const pdfPath = path.join(outDir, `${slug}.pdf`);
const coverPath = path.join(imagesDir, `${slug}-cover.webp`);

async function main() {
  // Fit-inside at print resolution, letterboxed onto a true Letter canvas.
  const pageBuffer = await sharp(srcPath)
    .resize(LETTER_PX.width, LETTER_PX.height, { fit: 'contain', background: LINEN })
    .jpeg({ quality: 92 })
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([LETTER_PT.width, LETTER_PT.height]);
  const embedded = await pdfDoc.embedJpg(pageBuffer);
  page.drawImage(embedded, { x: 0, y: 0, width: LETTER_PT.width, height: LETTER_PT.height });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
  console.log(`wrote ${pdfPath} (${(pdfBytes.length / 1024).toFixed(0)} KB, Letter ${LETTER_PT.width}x${LETTER_PT.height}pt)`);

  // Rail cover thumbnail -- same fit-inside/letterbox treatment so the
  // preview reads as the same page as the PDF, not a differently-cropped
  // teaser. ArticleRail renders these at aspect-[8.5/11] object-cover, so
  // the source dimensions just need to be that ratio; 850x1100 is plenty
  // for a 240px-wide rail tile.
  await sharp(srcPath)
    .resize(850, 1100, { fit: 'contain', background: LINEN })
    .webp({ quality: 82 })
    .toFile(coverPath);
  const coverBytes = fs.statSync(coverPath).size;
  console.log(`wrote ${coverPath} (${(coverBytes / 1024).toFixed(0)} KB)`);
}

main();
