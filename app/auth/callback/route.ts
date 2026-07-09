// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
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
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
