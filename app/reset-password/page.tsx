// app/reset-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Footer from '@/components/Footer';
import { LogoMark } from '@/components/Logo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // By the time this page loads, /auth/callback has already exchanged the
    // recovery code for a session — this just updates the password on it.
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push('/properties');
  }

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <LogoMark className="w-24 h-24" />
        </div>
        <h1 className="font-display text-2xl text-denim mb-1 text-center">Set a new password</h1>
        <p className="text-sm text-dusk mb-1 tracking-wide text-center">Sorted &amp; Stocked</p>
        <p className="text-sm text-dusk mb-6 text-center">Choose something you haven't used before.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2.5 bg-white"
            minLength={6}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2.5 bg-white"
            minLength={6}
            autoComplete="new-password"
            required
          />
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>

        <Footer />
      </div>
    </div>
  );
}
