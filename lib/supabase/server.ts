// lib/supabase/server.ts
// Requires: npm install @supabase/ssr @supabase/supabase-js
// Use this in server components, route handlers, and server actions.
// Never share a single instance across requests — always call this fresh.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies (no
            // response object). Safe to ignore as long as middleware.ts
            // is also refreshing the session on every request.
          }
        },
      },
    }
  );
}
