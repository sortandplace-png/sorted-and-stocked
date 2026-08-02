// components/marketing/ContactPageForm.tsx
// The /contact page's own form -- distinct from ConsultationForm (the
// homepage's inline version) because the brief specifies a different shape
// for the service field here (a single-select dropdown with an "Other",
// vs the homepage's multi-select checkboxes) and adds "How did you hear
// about us?", which the homepage's form does not ask.
//
// Posts to the SAME real backend as the homepage (/api/consultation-request
// -> consultation_requests), not a mailto: fallback. The brief said mailto
// is fine given "no backend needed yet" -- but a real, already-working,
// database-backed intake already exists, and mailto silently loses the
// lead entirely on a device with no mail client configured. Extending the
// real path serves the same goal (capture a request) more reliably, and
// keeps every lead in the same one table rather than splitting them
// between a database and someone's inbox depending which page they came
// from.
'use client';

import { useState } from 'react';

const SERVICE_OPTIONS = [
  'Full Home Organization',
  'Kitchen & Pantry Setup',
  'Newlywed Package',
  'Household Operations & Staff Management',
  'Pesach Prep',
  'Ongoing Management',
  // SS-488: new service, mirrored on /services and in the API allowlist.
  'Moving, Packing & Unpacking',
  'Other',
];

export default function ContactPageForm() {
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
      <p className="font-bold text-denim text-base py-6 text-center bg-card border border-cardBorder rounded-2xl shadow-card px-6">
        Thank you. We&apos;ll be in touch within 1 business day.
      </p>
    );
  }

  const field =
    'px-4 py-3 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 bg-card text-sm text-denim';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
      <input type="text" name="name" placeholder="Name" required className={field} />
      <input type="tel" name="phone" placeholder="Phone" required className={field} />
      <input type="email" name="email" placeholder="Email" required className={field} />
      <textarea name="notes" placeholder="Tell us about your home" rows={4} className={`${field} resize-none`} />

      <select
        name="serviceInterest"
        defaultValue=""
        className={field}
        aria-label="Service Interest"
      >
        <option value="" disabled>
          Service Interest
        </option>
        {SERVICE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <input type="text" name="heardAbout" placeholder="How did you hear about us?" className={field} />

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-denim text-white font-bold text-sm py-3.5 rounded-xl2 disabled:opacity-50 hover:opacity-90 transition-opacity mt-1"
      >
        {status === 'sending' ? 'Sending…' : 'Book Your Consultation'}
      </button>
      {status === 'error' && (
        <p className="text-rust text-xs text-center">Something went wrong sending your request. Please try again.</p>
      )}
    </form>
  );
}
