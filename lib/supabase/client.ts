// lib/supabase/client.ts
// Requires: npm install @supabase/supabase-js
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-auth',
        lifetime: 60 * 60 * 24 * 365, // 1 year
        domain: 'localhost',
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
