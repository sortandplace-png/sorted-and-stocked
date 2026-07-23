#!/usr/bin/env node
// scripts/gather-photo-candidates.ts
//
// Phase 1 of a two-phase pipeline, built after a real accuracy problem was
// found in inventory-photo-openfacts-batch.ts: that script's brand-token
// substring check (does the item's first word appear in the candidate's
// name/brand?) let through real category errors -- "Za'atar" matched
// "Za'atar Hummus" (spice vs. prepared dip), "Quinoa" matched quinoa
// crackers, "Half and Half" matched Ben & Jerry's "Half Baked" ice cream.
// A substring match proves word overlap, not "same kind of product."
//
// This script does NOT write anything to the database. It only gathers up
// to 3 real candidates per item (name/brand/full OFF or OBF category path)
// into a JSON file for a human -- or an LLM doing real semantic reading,
// not string matching -- to review and classify before anything is ever
// written. See scripts/apply-photo-candidates.mjs for phase 2.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);
const UA = 'SortedAndStocked-InventoryPhotoLookup/1.0 (contact: sortandplace@gmail.com)';

const FOOD_CATEGORIES = ['Pantry', 'Bakery', 'Beverages', 'Snacks & Candy', 'Frozen', 'Dairy', 'Meat & Seafood'];
const BEAUTY_CATEGORIES = ['Personal Care', 'Health & First Aid', 'Baby'];

async function lookup(dbHost: string, query: string): Promise<{ url: string; label: string; categories: string }[]> {
  const apiUrl = `https://${dbHost}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
  const res = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data) return [];
  const out: { url: string; label: string; categories: string }[] = [];
  for (const p of data.products ?? []) {
    const img = p.image_front_url || p.image_url;
    if (img) out.push({ url: img, label: `${p.product_name ?? ''} | ${p.brands ?? ''}`, categories: p.categories ?? '' });
    if (out.length >= 3) break;
  }
  return out;
}

type Row = { id: string; name: string; category: string; candidates: { url: string; label: string; categories: string }[] };

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

  console.log(`Gathering candidates for ${items.length} items (no writes)...\n`);
  const results: Row[] = [];

  for (const item of items) {
    const dbHost = FOOD_CATEGORIES.includes(item.category) ? 'world.openfoodfacts.org' : 'world.openbeautyfacts.org';
    process.stdout.write(`- ${item.name}... `);
    try {
      const candidates = await lookup(dbHost, item.name);
      console.log(candidates.length > 0 ? `${candidates.length} candidate(s)` : 'none');
      if (candidates.length > 0) {
        results.push({ id: item.id, name: item.name, category: item.category, candidates });
      }
    } catch (err) {
      console.log('ERROR:', err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  writeFileSync('scripts/photo-candidates-for-review.json', JSON.stringify(results, null, 2));
  console.log(`\n${results.length} items have at least one candidate. Written to scripts/photo-candidates-for-review.json for manual review.`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
