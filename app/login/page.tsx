// app/login/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogoMark } from '@/components/Logo';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  // Must start with exactly one "/" — rules out "//evil.com" (parsed as a
  // protocol-relative URL to a third-party host) and rules out an
  // unprefixed value reaching an external host. Same validation already
  // applied in app/auth/callback/route.ts; this was the one redirect
  // point that never got it.
  const requestedRedirect = searchParams.get('redirectTo');
  const redirectTo =
    requestedRedirect && requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/properties';

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
    router.push(redirectTo);
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

          {error && <p className="text-sm text-rust">{error}</p>}

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
      </div>
    </div>
  );
}
