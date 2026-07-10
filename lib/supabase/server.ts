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
      // Must match lib/supabase/client.ts's cookieOptions.name exactly --
      // without this, the server looks for @supabase/ssr's default cookie
      // name while the browser writes to 'sb-auth', so a freshly-logged-in
      // session is invisible server-side (confirmed directly: browser gets
      // a valid session + sb-auth cookie, but every server-rendered route
      // still sees no user and bounces back to /login). Present since the
      // initial commit -- never caught before because it only breaks a
      // brand-new login, not an already-established long-lived session
      // cookie predating this file.
      cookieOptions: {
        name: 'sb-auth',
        lifetime: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      },
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
