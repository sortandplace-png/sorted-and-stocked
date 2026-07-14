// app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogoMark } from '@/components/Logo';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/site-url';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'no-invite': "No account found for that Google sign-in — you'll need an invite first.",
  'auth-callback-failed': 'Sign-in failed. Please try again.',
  'auth-link-failed': "That link didn't work or has expired — request a new one and try again.",
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');
  const oauthErrorMessage = oauthError ? OAUTH_ERROR_MESSAGES[oauthError] ?? 'Sign-in failed. Please try again.' : null;

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    // Gated the same way as invite-code signup: app/auth/callback/route.ts
    // signs the user back out after the redirect if this account has no
    // property_members row, so a stray Google email can't self-provision
    // its way into the app.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // "Remember me" is on by default — sessions already persist across
    // restarts normally. Unchecking it means: sign out automatically the
    // next time this browser/tab is closed, rather than staying signed in
    // indefinitely. This is a real, honest behavior, not a cosmetic toggle.
    if (!rememberMe) {
      sessionStorage.setItem('sortedandstocked_no_remember', '1');
    } else {
      sessionStorage.removeItem('sortedandstocked_no_remember');
    }
    // Always /properties, never a preserved deep-link -- Dashboard (or the
    // properties picker, for a multi-household account) should be the
    // universal landing spot after signing in, no exceptions. Previously
    // restored whatever page the middleware had bounced the user from
    // (via a ?redirectTo= param), which is how a login could land back on
    // a scrolled-mid-page Tools view instead.
    router.push('/properties');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <LogoMark className="w-24 h-24" />
        </div>
        <h1 className="font-display text-3xl text-charcoal mb-1 text-center">Sign in</h1>
        <p className="text-sm text-charcoal/50 mb-6 tracking-wide text-center">Sorted &amp; Stocked · The Proactive Home Inventory System</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white"
            autoComplete="current-password"
            required
          />

          {(error || oauthErrorMessage) && <p className="text-sm text-rust">{error ?? oauthErrorMessage}</p>}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-charcoal/60">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-gold rounded"
              />
              Remember me
            </label>
            <a href="/forgot-password" className="text-sm text-charcoal/60">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {loading ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-gold-light/40" />
          <span className="text-xs text-charcoal/40">or</span>
          <div className="h-px flex-1 bg-gold-light/40" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-gold-light/60 bg-white text-charcoal font-medium disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? 'Please wait…' : 'Sign in with Google'}
        </button>

        <a href="/signup" className="block text-center text-sm text-charcoal/60 mt-4">
          Have a signup code? Create an account
        </a>

        <Footer />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
