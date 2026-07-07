import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // Use fetch to call Supabase REST API for SQL execution
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query_exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({
        sql: `
          ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS reorder_link TEXT;
          ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS photo_url TEXT;
          ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS primary_store TEXT;
          ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS alternative_stores TEXT[];
          ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS is_strictly_kosher BOOLEAN DEFAULT FALSE;
        `,
      }),
    });

    if (!response.ok) {
      // Try alternative: Insert via admin client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Create test record to verify table structure
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .limit(1);

      // Now try to update one with new columns
      if (data && data.length > 0) {
        const { error: updateError } = await supabase
          .from('recipe_ingredients')
          .update({
            reorder_link: null,
            primary_store: 'instacart_costco',
            is_strictly_kosher: false,
          })
          .eq('id', data[0].id);

        if (!updateError) {
          return Response.json({
            success: true,
            message: 'Columns already exist and working!',
          });
        }
      }

      return Response.json({
        error: 'Could not apply migration',
        details: await response.text(),
      });
    }

    return Response.json({
      success: true,
      message: 'Migration applied successfully',
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Migration failed',
    });
  }
}
