// app/api/clear-photos/route.ts
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Clear all photo URLs
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .update({ photo_url: null })
      .neq('photo_url', null);

    if (error) {
      console.error('Error clearing photos:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ All photo URLs cleared');
    return Response.json({ message: 'All photo URLs cleared', cleared: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
