import { createClient } from '@supabase/supabase-js';

// Public diagnostic endpoint - no auth required
export async function GET() {
  try {
    // Use anon key directly (no auth middleware)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Query staples count - should return 301
    const { data, error, count } = await supabase
      .from('staples')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return Response.json({
        status: 'error',
        message: error.message,
        code: error.code,
        env_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ missing',
        env_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ set' : '✗ missing'
      }, { status: 500 });
    }

    return Response.json({
      status: 'connected',
      staples_count: count || 0,
      expected: 301,
      match: count === 301 ? '✅ YES' : '❌ NO',
      message: 'App successfully queried the database'
    });
  } catch (err: any) {
    return Response.json({
      status: 'error',
      message: err.message,
      type: err.constructor.name
    }, { status: 500 });
  }
}
