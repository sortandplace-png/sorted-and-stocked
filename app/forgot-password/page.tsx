// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Footer from '@/components/Footer';
import { LogoMark } from '@/components/Logo';
import { SITE_URL } from '@/lib/site-url';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Routes through the existing /auth/callback code-exchange handler,
    // which then forwards to /reset-password once the recovery session
    // is established. SITE_URL, not window.location.origin -- local dev
    // and production share the same Supabase project, so triggering this
    // from a local dev server previously sent a real person a real email
    // with a localhost link they couldn't open.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback?redirectTo=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <LogoMark className="w-24 h-24" />
          </div>
          <p className="text-sm text-charcoal/50 mb-1 tracking-wide">Sorted &amp; Stocked</p>
          <h1 className="font-display text-2xl text-charcoal mb-2">Check your email</h1>
          <p className="text-sm text-charcoal/60">
            If an account exists for {email}, a password reset link is on its way.
          </p>
          <Footer />
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
        <h1 className="font-display text-2xl text-charcoal mb-1 text-center">Reset your password</h1>
        <p className="text-sm text-charcoal/50 mb-1 tracking-wide text-center">Sorted &amp; Stocked</p>
        <p className="text-sm text-charcoal/50 mb-6 text-center">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white"
            required
          />
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link href="/login" className="block text-center text-sm text-charcoal/60 mt-4">
          Back to sign in
        </Link>

        <Footer />
      </div>
    </div>
  );
}
