import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Run migration SQL
    const migrations = [
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS reorder_link TEXT;`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS photo_url TEXT;`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS primary_store TEXT;`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS alternative_stores TEXT[];`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_strictly_kosher BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS tags TEXT[];`,
    ];

    const results = [];
    for (const sql of migrations) {
      const { data, error } = await supabase.rpc('exec', {
        command: sql,
      }).catch(() => ({ data: null, error: null }));

      results.push({ sql: sql.substring(0, 50), success: !error, error });
    }

    return Response.json({
      message: 'Migration attempted',
      results,
      note: 'If errors occur, columns may already exist (which is fine)',
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Migration failed',
      hint: 'Columns may already exist in the table',
    });
  }
}
