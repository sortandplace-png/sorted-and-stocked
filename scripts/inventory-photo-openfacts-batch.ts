#!/usr/bin/env node
// scripts/inventory-photo-openfacts-batch.ts
//
// Follows directly from inventory-photo-pipeline.ts's 2026-07-09 pilot
// finding: Open Food Facts is safe/precise for branded food items but has
// real coverage gaps, especially for niche US-kosher brands; a blind
// "first search result" accept (as tried with Openverse) is UNSAFE --
// 0/9 correct on visual inspection in that pilot. This script only ever
// writes a photo when the item's own likely brand token (its first word,
// if it isn't a generic descriptor) actually appears in the candidate's
// product_name/brands fields -- if there's no brand token to check against,
// the item is skipped, not guessed.
//
// Walmart and Target were both confirmed bot-walled tonight (direct
// product-page fetches returned PerimeterX/px-captcha challenge pages, not
// real content) -- this is the fallback that doesn't require defeating a
// retailer's bot detection. Open Beauty Facts covers personal care;
// Open Products Facts was tested and found too sparse to bother with
// (0 results for a Great Value store-brand item) so it's not used here.
//
// Every photo is downloaded once and re-hosted in Supabase Storage via the
// existing lib/persist-photo.ts helper -- nothing is hotlinked.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { persistPhoto } from '../lib/persist-photo';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);
const BUCKET = 'inventory-photos';
const UA = 'SortedAndStocked-InventoryPhotoLookup/1.0 (contact: sortandplace@gmail.com)';

const FOOD_CATEGORIES = ['Pantry', 'Bakery', 'Beverages', 'Snacks & Candy', 'Frozen', 'Dairy', 'Meat & Seafood'];
const BEAUTY_CATEGORIES = ['Personal Care', 'Health & First Aid', 'Baby'];

// Generic descriptor words that don't count as a verifiable brand token --
// if an item's first word is one of these, it has no brand to check against
// and is skipped rather than guessed at.
const GENERIC_FIRST_WORDS = new Set([
  'ground', 'sliced', 'fresh', 'organic', 'natural', 'dried', 'chopped',
  'whole', 'raw', 'frozen', 'canned', 'crushed', 'shredded', 'diced',
  'minced', 'plain', 'assorted', 'mixed', 'liquid', 'dried', 'roasted',
  'toasted', 'grated', 'chicken', 'beef', 'turkey', 'vegetable', 'fish',
  'red', 'green', 'yellow', 'white', 'black', 'large', 'small', 'medium',
  'baby', 'extra', 'super', 'ultra', 'daily', 'facial', 'body', 'hand',
]);

function brandToken(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z']/g, '');
  if (!first || first.length < 3) return null;
  if (GENERIC_FIRST_WORDS.has(first.toLowerCase())) return null;
  return first.toLowerCase();
}

async function lookup(dbHost: string, query: string): Promise<{ url: string; label: string } | null> {
  const apiUrl = `https://${dbHost}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
  const res = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  for (const p of data.products ?? []) {
    const img = p.image_front_url || p.image_url;
    if (img) return { url: img, label: `${p.product_name ?? ''} | ${p.brands ?? ''}` };
  }
  return null;
}

type Result = { id: string; name: string; category: string; outcome: 'success' | 'no-brand' | 'no-match' | 'unverified' | 'error'; detail?: string };

async function run() {
  const { data: items, error } = await supabase
    .from('inventory_items')
    .select('id, name, category')
    .is('photo_url', null)
    .in('category', [...FOOD_CATEGORIES, ...BEAUTY_CATEGORIES]);

  if (error || !items) {
    console.error('Failed to load items:', error);
    process.exit(1);
  }

  console.log(`Loaded ${items.length} candidate items across food + beauty categories.\n`);
  const results: Result[] = [];

  for (const item of items) {
    const token = brandToken(item.name);
    process.stdout.write(`- ${item.name} [${item.category}]... `);

    if (!token) {
      console.log('SKIP (no verifiable brand token)');
      results.push({ id: item.id, name: item.name, category: item.category, outcome: 'no-brand' });
      continue;
    }

    const dbHost = FOOD_CATEGORIES.includes(item.category)
      ? 'world.openfoodfacts.org'
      : 'world.openbeautyfacts.org';

    try {
      const candidate = await lookup(dbHost, item.name);
      if (!candidate) {
        console.log('NO MATCH');
        results.push({ id: item.id, name: item.name, category: item.category, outcome: 'no-match' });
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }

      const labelLower = candidate.label.toLowerCase();
      if (!labelLower.includes(token)) {
        console.log(`UNVERIFIED (brand "${token}" not found in "${candidate.label}")`);
        results.push({ id: item.id, name: item.name, category: item.category, outcome: 'unverified', detail: candidate.label });
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }

      const hostedUrl = await persistPhoto(supabase, item.name, candidate.url, BUCKET);
      if (!hostedUrl) {
        console.log('DOWNLOAD/STORAGE FAILED');
        results.push({ id: item.id, name: item.name, category: item.category, outcome: 'error' });
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }

      const { error: updErr } = await supabase.from('inventory_items').update({ photo_url: hostedUrl }).eq('id', item.id);
      if (updErr) {
        console.log('DB UPDATE FAILED:', updErr.message);
        results.push({ id: item.id, name: item.name, category: item.category, outcome: 'error', detail: updErr.message });
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }

      console.log(`OK -> matched "${candidate.label}"`);
      results.push({ id: item.id, name: item.name, category: item.category, outcome: 'success', detail: candidate.label });
    } catch (err) {
      console.log('EXCEPTION:', err instanceof Error ? err.message : err);
      results.push({ id: item.id, name: item.name, category: item.category, outcome: 'error' });
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log('\n=== SUMMARY ===');
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  console.log(counts);
  console.log(`\nTotal candidates: ${items.length}, real photos added: ${counts.success ?? 0}`);

  const fs = require('fs');
  fs.writeFileSync('scripts/openfacts-batch-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull per-item results written to scripts/openfacts-batch-results.json');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
