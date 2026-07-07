import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Add shopping link columns to recipe_ingredients
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE recipe_ingredients
        ADD COLUMN IF NOT EXISTS reorder_link TEXT,
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_store TEXT,
        ADD COLUMN IF NOT EXISTS alternative_stores TEXT[],
        ADD COLUMN IF NOT EXISTS is_strictly_kosher BOOLEAN;
      `,
    });

    if (error) {
      // If RPC exec doesn't exist, try direct update approach
      return Response.json({
        message: 'Schema update - manual approach needed',
        note: 'Use Supabase dashboard SQL editor to run migrations',
        sql: `
        ALTER TABLE recipe_ingredients
        ADD COLUMN IF NOT EXISTS reorder_link TEXT,
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_store TEXT,
        ADD COLUMN IF NOT EXISTS alternative_stores TEXT[],
        ADD COLUMN IF NOT EXISTS is_strictly_kosher BOOLEAN;
        `,
      });
    }

    return Response.json({ message: 'Schema updated successfully' });
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : 'Unknown error',
      note: 'Please apply schema manually via Supabase dashboard',
    });
  }
}
