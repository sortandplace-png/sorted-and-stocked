// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
    // is established.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirectTo=/reset-password`,
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
          <h1 className="font-display text-2xl text-charcoal mb-2">Check your email</h1>
          <p className="text-sm text-charcoal/60">
            If an account exists for {email}, a password reset link is on its way.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <h1 className="font-display text-2xl text-charcoal mb-1">Reset your password</h1>
        <p className="text-sm text-charcoal/50 mb-6">
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
      </div>
    </div>
  );
}
