// app/auth/confirm/page.tsx
// Real root cause of invited accounts never actually signing in: an invite
// link generated via the Admin API (admin.generateLink / inviteUserByEmail
// in app/api/invite/route.ts) never uses PKCE, even if the client is
// configured for it -- confirmed directly against Supabase's own docs.
// PKCE requires the same browser that started the request to finish it,
// which is structurally impossible for an admin-generated link (the
// "browser" that requested it is a server, not the recipient's device), so
// Supabase falls back to delivering the session via a #access_token=...
// hash fragment instead of a ?code= query param. A hash fragment is never
// sent to the server, so app/auth/callback/route.ts (a plain server Route
// Handler that only reads ?code=) can never see it -- confirmed live:
// invited accounts have confirmation_sent_at set but never get a working
// session. Password recovery (resetPasswordForEmail, browser-initiated) is
// a genuinely different flow that DOES use PKCE -- that one is correctly
// handled by /auth/callback already, verified live tonight. This page is
// specifically for the admin-generated-link case /auth/callback can't
// cover, not a replacement for it.
'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const requestedRedirect = searchParams.get('redirectTo');
    // Same open-redirect guard as /login and /auth/callback.
    const redirectTo =
      requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
        ? requestedRedirect
        : '/properties';

    let redirected = false;
    function goToApp() {
      if (redirected) return;
      redirected = true;
      router.replace(redirectTo);
    }

    // Fires once the SDK actually finishes establishing a session, whether
    // that came from the hash fragment (detectSessionInUrl, on by default)
    // or exchangeCodeForSession below -- more reliable than polling
    // getSession() immediately after mount.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goToApp();
    });

    (async () => {
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return; // onAuthStateChange above will fire and redirect
      }

      // Give the hash-fragment auto-detection a real window to finish
      // before concluding this link genuinely didn't work.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        goToApp();
      } else {
        router.replace('/login?error=auth-link-failed');
      }
    })();

    return () => sub.subscription.unsubscribe();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <p className="text-sm text-charcoal/50">Signing you in…</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
