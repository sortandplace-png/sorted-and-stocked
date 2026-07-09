#!/usr/bin/env node
// scripts/inventory-photo-pipeline.ts
//
// VERIFIED RESULTS (2026-07-09 test batch, visually checked every result,
// not just "did a URL come back"):
//   - Open Food Facts (branded packaged products): 2/5 found a product at
//     all, but both matches were visually confirmed correct (Barilla
//     Marinara, Ortega Taco Seasoning). Good precision, real gap in
//     database coverage for non-food/household brands (Kleenex, Dove) —
//     OFF is food-only. SAFE TO REUSE for branded food items.
//   - Openverse (generic/unbranded staples), "first keyword search result":
//     9/9 technically downloaded and stored, but 0/9 were actually correct
//     on visual inspection — e.g. "Paprika" returned a restaurant storefront
//     photo, "Chicken Stock" returned a carton of eggs, "Avocado" returned
//     an avocado-pit houseplant. All 9 were reverted (photo_url set back to
//     null) and the wrong files deleted from Storage. DO NOT reuse the
//     Openverse lookup as implemented here without adding real relevance
//     filtering (e.g. require the query terms in the image's title/tags,
//     not just full-text match) or a human review step before accepting.
//
// Every photo is downloaded once and re-hosted in Supabase Storage via the
// existing lib/persist-photo.ts helper (same pattern as recipe/ingredient
// photos) — nothing is hotlinked. Items with no good match are left null
// and logged, not guessed. Do not scale this to the full ~583 missing
// items until the Openverse matching problem above is actually fixed.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { persistPhoto } from '../lib/persist-photo';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openverseClientId = process.env.OPENVERSE_CLIENT_ID!;
const openverseClientSecret = process.env.OPENVERSE_CLIENT_SECRET!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const BUCKET = 'inventory-photos';
const OFF_USER_AGENT = 'SortedAndStocked/1.0 (contact: racq1020@gmail.com)';

type Source = 'off' | 'openverse';
type TestItem = { id: string; name: string; source: Source; query: string };

// Manually classified test batch — 14 items across both sources, drawn from
// a random sample of the 583 currently missing photo_url.
const TEST_BATCH: TestItem[] = [
  // Branded packaged products -> Open Food Facts
  { id: '24eecd65-d7f5-4e23-85bf-c20313dcbd7d', name: 'Ortega Taco Seasoning Mix', source: 'off', query: 'Ortega Taco Seasoning Mix' },
  { id: '994b1c85-8028-4019-b401-f3d06d6b3deb', name: 'Gefen Cholent Mix Chulent 16 Oz', source: 'off', query: 'Gefen Cholent Mix' },
  { id: '359b9402-4fc3-47ae-902b-442cbe823167', name: 'Barilla Classic Marinara Tomato Pasta Sauce', source: 'off', query: 'Barilla Marinara Pasta Sauce' },
  { id: '8f1f93bb-e4d6-45f2-857b-240243b2b279', name: 'Facial Tissues (Kleenex)', source: 'off', query: 'Kleenex Facial Tissues' },
  { id: 'df7a051c-df7f-4578-bab4-31ef56a82323', name: 'Dove Antiperspirant Deodorant (travel)', source: 'off', query: 'Dove Antiperspirant Deodorant' },
  // Generic/unbranded staples -> Openverse
  { id: '70cf1303-4361-4b55-a372-39d239fd256e', name: 'Portobello Mushroom', source: 'openverse', query: 'portobello mushroom' },
  { id: 'babb9094-1649-4ce2-8acc-9d5bb19d39ee', name: 'Paprika', source: 'openverse', query: 'paprika spice' },
  { id: '8e367c7e-b7d7-4fda-be4c-983ad3f53b5c', name: 'Shredded Mozzarella', source: 'openverse', query: 'shredded mozzarella cheese' },
  { id: 'febbf1f9-2f95-479b-a57b-a78b4ed3098f', name: 'Avocado', source: 'openverse', query: 'avocado' },
  { id: '2e58baec-ae55-4b04-a266-35ec22d0e388', name: 'Ground Ginger', source: 'openverse', query: 'ground ginger spice' },
  { id: '333b5876-a26b-43bf-b344-2991206c40bf', name: "Za'atar", source: 'openverse', query: 'zaatar spice' },
  { id: '87a72ed7-1fd9-4f02-839b-68d62ae18653', name: 'Batteries (AA)', source: 'openverse', query: 'AA batteries' },
  { id: '14b9607a-328e-47b3-977e-0a5fb8ac757c', name: 'Toothpaste', source: 'openverse', query: 'toothpaste tube' },
  { id: '9d230946-5aea-4c20-adde-629eb046d0b4', name: 'Chicken Stock', source: 'openverse', query: 'chicken stock carton' },
];

async function lookupOpenFoodFacts(query: string): Promise<string | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query
  )}&search_simple=1&action=process&json=1&page_size=5`;
  const res = await fetch(url, { headers: { 'User-Agent': OFF_USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const products = data.products ?? [];
  for (const p of products) {
    const img = p.image_front_url || p.image_url;
    if (img) return img;
  }
  return null;
}

let openverseToken: string | null = null;
async function getOpenverseToken(): Promise<string | null> {
  if (openverseToken) return openverseToken;
  if (!openverseClientId || !openverseClientSecret) return null;
  const res = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: openverseClientId,
      client_secret: openverseClientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    console.error('[Openverse] token request failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  openverseToken = data.access_token;
  return openverseToken;
}

async function lookupOpenverse(query: string): Promise<string | null> {
  const token = await getOpenverseToken();
  if (!token) return null;
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    query
  )}&license_type=commercial&page_size=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results ?? [];
  for (const r of results) {
    if (r.url) return r.url;
  }
  return null;
}

async function run() {
  console.log(`Running test batch of ${TEST_BATCH.length} items against ${BUCKET}...\n`);
  const results: { name: string; source: Source; outcome: 'success' | 'no-match' | 'error' }[] = [];

  for (const item of TEST_BATCH) {
    process.stdout.write(`- ${item.name} (${item.source})... `);
    try {
      const candidate =
        item.source === 'off' ? await lookupOpenFoodFacts(item.query) : await lookupOpenverse(item.query);

      if (!candidate) {
        console.log('NO MATCH — leaving photo_url null');
        results.push({ name: item.name, source: item.source, outcome: 'no-match' });
        continue;
      }

      const hostedUrl = await persistPhoto(supabase, item.name, candidate, BUCKET);
      if (!hostedUrl) {
        console.log('DOWNLOAD/STORAGE FAILED');
        results.push({ name: item.name, source: item.source, outcome: 'error' });
        continue;
      }

      const { error } = await supabase.from('inventory_items').update({ photo_url: hostedUrl }).eq('id', item.id);
      if (error) {
        console.log('DB UPDATE FAILED:', error.message);
        results.push({ name: item.name, source: item.source, outcome: 'error' });
        continue;
      }

      console.log(`OK -> ${hostedUrl}`);
      results.push({ name: item.name, source: item.source, outcome: 'success' });
    } catch (err) {
      console.log('EXCEPTION:', err instanceof Error ? err.message : err);
      results.push({ name: item.name, source: item.source, outcome: 'error' });
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite to both free APIs
  }

  console.log('\n--- Summary ---');
  const bySource = (s: Source) => results.filter((r) => r.source === s);
  for (const s of ['off', 'openverse'] as Source[]) {
    const rows = bySource(s);
    const ok = rows.filter((r) => r.outcome === 'success').length;
    console.log(`${s}: ${ok}/${rows.length} succeeded`);
  }
  const failed = results.filter((r) => r.outcome !== 'success');
  if (failed.length > 0) {
    console.log('\nNot matched / failed:');
    for (const f of failed) console.log(`  - ${f.name} (${f.source}): ${f.outcome}`);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
