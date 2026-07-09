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
        // No hardcoded domain — that broke auth entirely on any real
        // deployment (browsers refuse to set a cookie for a domain that
        // doesn't match the page's actual host). Omitting it lets the
        // browser default to the current site's own domain, which is
        // correct in both local dev and production with no env-specific
        // value needed.
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
