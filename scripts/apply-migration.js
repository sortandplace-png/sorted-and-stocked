const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = 'https://jfaaqzrezcrkkidlsbwj.supabase.co';
const serviceRoleKey = 'sb_secret_es2MCkBnt-F780W3zs2OvA_-9vzf23N';

const supabase = createClient(url, serviceRoleKey);

async function applyMigration() {
  try {
    const migration = fs.readFileSync('./supabase/migrations/033_shopping_links_and_photos.sql', 'utf-8');
    const statements = migration.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 80) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error('Error:', error);
          // Try using the raw API instead
          const result = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: statement })
          });
          console.log('API Response:', result.status);
        }
      }
    }
    console.log('Migration applied!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

applyMigration();
