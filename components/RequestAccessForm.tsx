// components/RequestAccessForm.tsx
'use client';

import { useState } from 'react';

export default function RequestAccessForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    try {
      const res = await fetch('/api/request-access', { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p className="font-bold text-ink text-sm py-3">
        Thank you — we've received your request and will be in touch soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[380px] mx-auto flex flex-col gap-3">
      <input
        type="text"
        name="name"
        placeholder="Your name"
        required
        className="px-4 py-3 border border-line rounded bg-cream text-sm"
      />
      <input
        type="email"
        name="email"
        placeholder="Email address"
        required
        className="px-4 py-3 border border-line rounded bg-cream text-sm"
      />
      <input
        type="text"
        name="city"
        placeholder="City (optional)"
        className="px-4 py-3 border border-line rounded bg-cream text-sm"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-ink text-cream font-bold text-sm py-3.5 rounded disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Request Early Access'}
      </button>
      {status === 'error' && (
        <p className="text-rust text-xs">Something went wrong sending your request — please try again.</p>
      )}
    </form>
  );
}
