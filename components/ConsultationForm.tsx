// components/ConsultationForm.tsx
// "Book Your Consultation" intake form for the root (/) marketing page.
// Posts to app/api/consultation-request, which stores it in
// consultation_requests before attempting a notification email.
'use client';

import { useState } from 'react';

const SERVICE_OPTIONS = [
  'Full Home Organization',
  'Kitchen/Pantry Setup',
  'Newlywed Package',
  'Household Operations/Staff Management',
];

export default function ConsultationForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    try {
      const res = await fetch('/api/consultation-request', { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p className="font-bold text-denim text-sm py-3 text-center">
        Thank you — we've received your request and will be in touch soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[440px] mx-auto flex flex-col gap-3 text-left">
      <input
        type="text"
        name="name"
        placeholder="Full Name"
        required
        className="px-4 py-3 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl bg-card text-sm text-denim"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Phone Number"
        required
        className="px-4 py-3 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl bg-card text-sm text-denim"
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        required
        className="px-4 py-3 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl bg-card text-sm text-denim"
      />

      <fieldset className="border border-cardBorder rounded-xl px-4 py-3 bg-card">
        <legend className="text-xs font-semibold uppercase tracking-wide text-dusk px-1">Service Interest</legend>
        <div className="flex flex-col gap-2 mt-1.5">
          {SERVICE_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2.5 text-sm text-denim">
              <input
                type="checkbox"
                name="serviceInterest"
                value={option}
                className="w-4 h-4 rounded border-cardBorder text-brass focus:ring-brass/40"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <textarea
        name="notes"
        placeholder="Notes (optional)"
        rows={3}
        className="px-4 py-3 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl bg-card text-sm text-denim resize-none"
      />

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-denim text-white font-bold text-sm py-3.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {status === 'sending' ? 'Sending…' : 'Book Your Consultation'}
      </button>
      {status === 'error' && (
        <p className="text-rust text-xs text-center">Something went wrong sending your request — please try again.</p>
      )}
    </form>
  );
}
