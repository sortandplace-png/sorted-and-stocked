// lib/supabase/middleware.ts
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// /auth/confirm and /reset-password: someone clicking an invite link is by
// definition not signed in yet, and the session it establishes is set
// client-side (via the Supabase SDK reading the URL) a moment after the
// initial navigation -- both need to be reachable before that lands.
// /services, /about, /faq, /contact: the 4 public marketing pages added
// alongside the root landing page (2026-07-29) -- same reasoning as root
// itself, just via startsWith() rather than root's exact-match, since none
// of these four collide with any existing route prefix in this app.
// Without this, Googlebot (and every other signed-out visitor) would be
// redirected to /login on all four, which is exactly the failure mode this
// batch of pages exists to avoid.
// /privacy and /terms (clean, extension-less) rewrite to the .html files in
// next.config.js -- Google consent-screen verification hits the clean URLs,
// so they must be public here too, not just the .html variants.
// /sitemap: the human sitemap page (SS-432 part 2). startsWith() also
// covers /sitemap.xml, which was previously public only via the matcher
// exclusion in middleware.ts -- harmless overlap, both are public.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/confirm', '/forgot-password', '/reset-password', '/signup', '/welcome', '/entry', '/privacy.html', '/terms.html', '/privacy', '/terms', '/cookie-policy.html', '/blog', '/services', '/about', '/faq', '/contact', '/sitemap'];

export async function updateSession(request: NextRequest) {
  // request.headers (the incoming request's own Headers object) is
  // immutable -- .set() on it directly is a silent no-op, not a throw, so
  // this needs its own mutable copy. Passed as { request: { headers } }
  // (the documented shape), not the raw `request` object itself, at every
  // NextResponse.next() call below so it survives the cookies.setAll
  // reassignment too -- the only way a downstream Server Component can
  // recover the matched pathname via next/headers' headers(), since
  // layouts don't receive it as a prop the way page.tsx's
  // searchParams/params do. Read by app/properties/[id]/layout.tsx for
  // module-flag route gating.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
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

  // Root ("/") is public too, as of app/page.tsx becoming the marketing
  // landing page (2026-07-21) -- but checked with an EXACT match, never
  // folded into PUBLIC_PATHS's startsWith() list above. Every path starts
  // with "/", so adding it there would make isPublicPath true for the
  // entire app and disable auth everywhere, not just at root.
  const isRoot = request.nextUrl.pathname === '/';
  const isPublicPath = isRoot || PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    // No ?redirectTo= -- login always lands on /properties (Dashboard, or
    // the household picker), never back on whatever deep link triggered
    // the bounce. See app/login/page.tsx.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}
