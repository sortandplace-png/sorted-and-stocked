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
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/properties';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (mode === 'sign-in') {
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
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // If email confirmation is enabled in Supabase Auth settings, there's
      // no session yet — tell the person to check their inbox instead of
      // silently doing nothing.
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl text-charcoal mb-2">Check your email</h1>
          <p className="text-sm text-charcoal/60">
            We sent a confirmation link to {email}. Follow it to finish signing up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <LogoMark className="w-24 h-24" />
        </div>
        <h1 className="font-display text-3xl text-charcoal mb-1 text-center">
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="text-sm text-charcoal/50 mb-6 tracking-wide text-center">Sorted &amp; Stocked · The Proactive Home Inventory System</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'sign-up' && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white"
              required
            />
          )}
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
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />

          {error && <p className="text-sm text-rust">{error}</p>}

          {mode === 'sign-in' && (
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
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
          }}
          className="w-full text-center text-sm text-charcoal/60 mt-4"
        >
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
