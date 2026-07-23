// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  // request.url reflects the internal host when running behind a reverse
  // proxy, not the public-facing domain — same fix already applied in
  // app/api/invite/route.ts, just missing here (app/api/invite/resend/
  // route.ts deliberately does NOT use this pattern -- it sends a fixed
  // SITE_URL into an email instead of building a redirect, so it needs
  // the site's real public URL regardless of which host triggered the
  // resend, not this request's own forwarded host). Matters most for
  // this route specifically since it's where every login/invite/magic-
  // link flow actually completes.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const origin = forwardedHost ? `${forwardedProto ?? 'https'}://${forwardedHost}` : rawOrigin;
  const code = searchParams.get('code');
  const requestedRedirect = searchParams.get('redirectTo');
  // Must start with exactly one "/" — rules out "//evil.com" (parsed as a
  // protocol-relative URL to a third-party host) and rules out an
  // unprefixed value like "@evil.com" reaching the authority section once
  // concatenated onto origin below (a single leading slash always
  // terminates the authority, forcing everything after it to be a path).
  const redirectTo =
    requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/properties';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
  }

  // Build the response we're going to return FIRST, and have the cookie
  // adapter write directly onto it. Previously this route used
  // lib/supabase/server.ts's createClient(), which sets cookies via
  // next/headers' cookies().set() and relies on Next.js to propagate those
  // onto whatever NextResponse gets constructed later. That's Supabase's
  // own documented pattern and usually works -- but confirmed live (auth
  // logs: token exchange succeeds, "Login" event fires for provider=google,
  // property_members count is non-zero so the no-invite gate below never
  // even fires) that the session was not surviving to the very next
  // request: the same account fell back to a password sign-in within
  // seconds, right after a "successful" Google round trip, twice in a row.
  // Writing cookies straight onto the exact response object being returned
  // removes the gap between "exchange succeeded" and "browser actually has
  // the cookie." Same pattern lib/supabase/middleware.ts already uses.
  const successResponse = NextResponse.redirect(`${origin}${redirectTo}`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Must match lib/supabase/client.ts's cookieOptions.name -- see the
      // matching comment in lib/supabase/server.ts.
      cookieOptions: { name: 'sb-auth', lifetime: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
  }

  // Google sign-in (the only OAuth provider) auto-creates a brand-new
  // auth.users row for any Google email that doesn't already have an
  // account -- there's no built-in "existing users only" toggle on
  // Supabase's side. Every legitimate account in this app (password
  // signup via app/api/signup/route.ts, or an accepted invite via
  // app/api/invite/route.ts) always has at least one real property_members
  // row by the time this callback runs. Zero rows means a Google sign-in
  // just minted a new account with no invite behind it -- exactly the gate
  // the invite-code signup flow exists to enforce, applied here after the
  // OAuth redirect instead of before it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { count } = await supabase
      .from('property_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!count) {
      await supabase.auth.signOut();
      // signOut()'s cookie-clearing writes also went through setAll above,
      // so they landed on successResponse -- copy them onto the response
      // actually being returned for this branch.
      const noInviteResponse = NextResponse.redirect(`${origin}/login?error=no-invite`);
      successResponse.cookies.getAll().forEach((c) => noInviteResponse.cookies.set(c));
      return noInviteResponse;
    }
  }

  return successResponse;
}
