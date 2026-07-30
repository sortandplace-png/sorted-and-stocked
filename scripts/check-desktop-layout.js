#!/usr/bin/env node
// scripts/check-desktop-layout.js
// SS-400. Desktop is a required view, not an option.
//
// WHY A SCRIPT AND NOT A CONVENTION: the lg:max-w-* pattern already existed
// in 12 files and was still missed in 31. An unenforced convention has
// failed 31 times; a written requirement would be the 32nd. This makes it
// structural.
//
// WHY A BASELINE RATCHET AND NOT A HARD FAIL ON EVERYTHING: failing on all
// 31 today would break every deploy until the entire backlog is cleared,
// which turns a quality gate into a blocker. Instead the 31 known offenders
// are listed below and tolerated; ANY violation not on that list fails the
// build immediately. So the 32nd can never happen, and the list only ever
// shrinks -- delete a filename as you fix it. Removing the last entry
// leaves a rule that simply fails on any violation, with no ceremony.
//
// Wired into `prebuild`, so `npm run build` runs it. Same mechanism as
// scripts/check-test-data.js.
const fs = require('fs');
const path = require('path');

const ROOTS = ['app', 'components'];

// Genuinely phone-shaped by nature -- a wide column would be WORSE, not
// better. These are camera viewfinders and single-action tools where the
// content is one control, not a list or a table.
const ALLOWLIST = new Set([
  'components/CapturePhotoClient.tsx',        // live camera viewfinder
  'components/IdentifyItemClient.tsx',        // single photo -> single answer
  'components/IngredientScannerClient.tsx',   // point camera at one label
  'components/PhotoToolClient.tsx',           // camera capture flow
  'components/QuickPhotoCaptureClient.tsx',   // one photo, one item, one save
  'components/ScanClient.tsx',                // QR/barcode viewfinder
  'app/properties/[id]/tools/kitchen-timer/page.tsx', // a list of timers, never wide
  'components/KitchenTimerClient.tsx',        // same timer list, also mounted as a floating widget on Recipes
  'components/QRScanner.tsx',                 // the camera element itself
  'app/scan/[code]/page.tsx',                 // a single "barcode not recognised" message + one link
  'components/Skeleton.tsx',                  // loading placeholder -- must match whatever container it stands in for, so it moves with its consumers, not alone
]);

// Known offenders as of the SS-400 audit. Delete a line as you fix it.
// Nothing may be ADDED here without a deliberate decision.
const BASELINE = new Set([
  'components/BackupDownloadClient.tsx',
  'components/BorrowedItemsClient.tsx',
  'components/CaptureInboxClient.tsx',
  'components/DuplicateIngredientsClient.tsx',
  'components/GuestScalerClient.tsx',
  'components/GuestTasteMemoryClient.tsx',
  'components/HechsherVerificationClient.tsx',
  'components/HomeMemoryTimelineClient.tsx',
  'components/HouseholdContactsClient.tsx',
  'components/HouseholdKnowledgeClient.tsx',
  'components/KosherTypeTaggingClient.tsx',
  'components/LinkCapturedPhotosClient.tsx',
  'components/LocalFoodDirectoryClient.tsx',
  // Found by the rule itself, not the original grep -- see SS-400 note.
  'components/MealPlanViewer.tsx',
  'components/NeedsLinkingClient.tsx',
  'components/PantryZonesClient.tsx',
  'components/PhotoWorklistClient.tsx',
  'components/PrepTimelineClient.tsx',
  'components/RecipeDetailClient.tsx',
  'components/ResetChecklistClient.tsx',
  'components/SettingsClient.tsx',
  'components/ShelfAuditorView.tsx',
  'components/ShiftHandoverClient.tsx',
  'components/TranslationWorklistClient.tsx',
  'app/properties/page.tsx',
]);

// A page-level container is max-w-{xs,sm,md} together with mx-auto.
// mx-auto is what distinguishes a centred page column from an inline
// element that merely has a width cap.
const PHONE_CAP = /max-w-(?:xs|sm|md)\b/;
const CENTRED = /\bmx-auto\b/;
const HAS_DESKTOP = /\blg:max-w-/;
// Modals and sheets legitimately stay narrow at every width. Two reliable
// tells, both found by running this rule and reading what it caught:
// a viewport-height cap (max-h-[85vh]), and the bottom-sheet corner
// treatment (rounded-t-[2rem] sm:rounded-3xl) this app uses for every
// slide-up panel. Page containers carry neither.
const MODAL_HINT = /max-h-\[|rounded-t-\[/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const rel = file.split(path.sep).join('/');
    if (ALLOWLIST.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!PHONE_CAP.test(line)) return;
      if (!CENTRED.test(line)) return;
      if (HAS_DESKTOP.test(line)) return;
      if (MODAL_HINT.test(line)) return;
      offenders.push({ rel, line: i + 1, text: line.trim().slice(0, 100) });
    });
  }
}

const newOnes = offenders.filter((o) => !BASELINE.has(o.rel));
const known = offenders.filter((o) => BASELINE.has(o.rel));

if (newOnes.length > 0) {
  console.error('\n✘ SS-400: page-level container with no desktop layout.\n');
  console.error('  Desktop is a required view. Add an lg:max-w-* override');
  console.error('  (see components/InventoryClient.tsx: "max-w-md lg:max-w-6xl"),');
  console.error('  or add the file to ALLOWLIST in scripts/check-desktop-layout.js');
  console.error('  WITH a comment explaining why it is genuinely phone-shaped.\n');
  for (const o of newOnes) console.error(`  ${o.rel}:${o.line}\n    ${o.text}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ SS-400 desktop-layout check: no new violations` +
    (known.length ? ` (${known.length} known, from the audit baseline)` : '')
);
