#!/usr/bin/env node
// scripts/fix-hotlinked-photos.ts
// One-time cleanup: re-hosts every inventory_items.photo_url that's
// currently hotlinked to an external site into the inventory-photos
// Supabase Storage bucket (same pattern as lib/persist-photo.ts already
// uses for recipe/ingredient photos). Groups rows by identical URL first
// so a photo shared across multiple location-rows for the same product
// is only downloaded once. Anything that fails to download gets
// photo_url set to null rather than left as a broken/fragile hotlink.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { persistPhoto } from '../lib/persist-photo';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PROPERTY_ID = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a';
const BUCKET = 'inventory-photos';

async function run() {
  const { data: rows, error } = await supabase
    .from('inventory_items')
    .select('id, name, photo_url')
    .eq('property_id', PROPERTY_ID)
    .not('photo_url', 'is', null)
    .not('photo_url', 'like', `%/${BUCKET}/%`);

  if (error || !rows) {
    console.error('Failed to fetch rows:', error);
    process.exit(1);
  }

  const byUrl = new Map<string, { id: string; name: string }[]>();
  for (const r of rows) {
    const list = byUrl.get(r.photo_url!) ?? [];
    list.push({ id: r.id, name: r.name });
    byUrl.set(r.photo_url!, list);
  }

  console.log(`${rows.length} rows across ${byUrl.size} distinct hotlinked URLs.\n`);

  let rehostedUrls = 0;
  let rehostedRows = 0;
  let failedUrls = 0;
  let failedRows = 0;
  const failuresByHost: Record<string, number> = {};

  for (const [url, items] of byUrl) {
    const label = items[0].name;
    process.stdout.write(`- ${label} (${items.length} row${items.length > 1 ? 's' : ''})... `);
    const hosted = await persistPhoto(supabase, label, url, BUCKET);

    if (hosted) {
      const { error: updErr } = await supabase
        .from('inventory_items')
        .update({ photo_url: hosted })
        .in('id', items.map((i) => i.id));
      if (updErr) {
        console.log('DB UPDATE FAILED:', updErr.message);
      } else {
        console.log(`OK -> ${hosted}`);
        rehostedUrls++;
        rehostedRows += items.length;
      }
    } else {
      const { error: updErr } = await supabase
        .from('inventory_items')
        .update({ photo_url: null })
        .in('id', items.map((i) => i.id));
      const host = (() => {
        try {
          return new URL(url).host;
        } catch {
          return 'unknown';
        }
      })();
      failuresByHost[host] = (failuresByHost[host] ?? 0) + 1;
      if (updErr) {
        console.log('DOWNLOAD FAILED, AND DB NULL-OUT FAILED:', updErr.message);
      } else {
        console.log('DOWNLOAD FAILED -> set to null');
      }
      failedUrls++;
      failedRows += items.length;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n--- Summary ---');
  console.log(`Re-hosted: ${rehostedUrls} distinct URLs (${rehostedRows} rows)`);
  console.log(`Failed / nulled: ${failedUrls} distinct URLs (${failedRows} rows)`);
  if (Object.keys(failuresByHost).length > 0) {
    console.log('\nFailures by host:');
    for (const [host, count] of Object.entries(failuresByHost).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${host}: ${count}`);
    }
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
