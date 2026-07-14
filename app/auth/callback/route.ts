// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  // request.url reflects the internal host when running behind a reverse
  // proxy, not the public-facing domain — same fix already applied in
  // app/api/invite/route.ts and app/api/invite/resend/route.ts, just
  // missing here. Matters most for this route specifically since it's
  // where every login/invite/magic-link flow actually completes.
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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google sign-in (the only OAuth provider) auto-creates a brand-new
      // auth.users row for any Google email that doesn't already have an
      // account -- there's no built-in "existing users only" toggle on
      // Supabase's side. Every legitimate account in this app (password
      // signup via app/api/signup/route.ts, or an accepted invite via
      // app/api/invite/route.ts) always has at least one real
      // property_members row by the time this callback runs. Zero rows
      // means a Google sign-in just minted a new account with no invite
      // behind it -- exactly the gate the invite-code signup flow exists
      // to enforce, applied here after the OAuth redirect instead of
      // before it.
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
          return NextResponse.redirect(`${origin}/login?error=no-invite`);
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
