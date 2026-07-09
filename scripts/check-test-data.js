// scripts/check-test-data.js
// Fails the build if a seed/migration left an obvious test-data record
// behind (e.g. "Test Milk") — runs as a `prebuild` step. No CI pipeline
// exists yet for this repo, so this is wired into `npm run build` directly;
// once real CI is set up it'll already be part of that build step.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('check-test-data: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping check.');
  process.exit(0);
}

const supabase = createClient(url, key);

const CHECKS = [
  { table: 'inventory_items', columns: ['name', 'name_es'] },
  { table: 'recipes', columns: ['name', 'name_es'] },
  { table: 'recipe_ingredients', columns: ['name'] },
];

async function main() {
  let found = [];

  for (const { table, columns } of CHECKS) {
    for (const column of columns) {
      const { data, error } = await supabase.from(table).select(`id, ${column}`).ilike(column, '%test%');
      if (error) {
        console.error(`check-test-data: query failed on ${table}.${column}:`, error.message);
        process.exit(1);
      }
      for (const row of data ?? []) {
        found.push(`${table}.${column} — id ${row.id}: "${row[column]}"`);
      }
    }
  }

  if (found.length > 0) {
    console.error('check-test-data: found record(s) with "test" in a name field:');
    for (const line of found) console.error(`  - ${line}`);
    console.error('Remove these before building, or confirm they are intentional and adjust this check.');
    process.exit(1);
  }

  console.log('check-test-data: clean, no test-data records found.');
}

main();
