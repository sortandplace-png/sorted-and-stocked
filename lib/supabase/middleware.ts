// lib/supabase/middleware.ts
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/forgot-password'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Must match lib/supabase/client.ts's cookieOptions.name -- see the
      // matching comment in lib/supabase/server.ts for the full story.
      cookieOptions: {
        name: 'sb-auth',
        lifetime: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call must not be removed — it's what actually refreshes
  // the auth token. Skipping it causes silent, random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    // No ?redirectTo= -- login always lands on /properties (Dashboard, or
    // the household picker), never back on whatever deep link triggered
    // the bounce. See app/login/page.tsx.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}
