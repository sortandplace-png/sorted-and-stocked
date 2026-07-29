// components/marketing/ContactForm.tsx
// Contact form for /contact. No backend yet, as specified: submitting opens
// the visitor's mail client with the contents pre-filled.
//
// Worth being honest about the limits of that, because they are not
// obvious. mailto: hands off to whatever mail app the device has -- if the
// visitor has none configured, nothing happens and they get no feedback
// from the browser at all. So this shows the confirmation AND leaves the
// address visible as plain text underneath, giving a path that works even
// when the handoff silently fails. Nothing is stored anywhere until there
// is a real endpoint; a submission that never opens is a lost lead with no
// record, which is the thing to fix when this gets a backend.
'use client';

import { useState } from 'react';

const TO = 'sortandplace@gmail.com';

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    home: '',
    heard: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = [
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      '',
      'About their home:',
      form.home,
      '',
      `How they heard about us: ${form.heard}`,
    ].join('\n');

    // encodeURIComponent on both parts: an ampersand or a line break in the
    // free-text field would otherwise truncate the body at that character.
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(
      `Website enquiry from ${form.name || 'a visitor'}`
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const field =
    'w-full bg-card border border-cardBorder rounded-xl2 px-3.5 py-2.5 text-[14px] text-denim placeholder:text-dusk focus:border-brass focus:outline-none';
  const label = 'block text-[11px] font-semibold uppercase tracking-[0.14em] text-dusk mb-1.5';

  if (sent) {
    return (
      <div className="bg-card border border-cardBorder rounded-xl3 shadow-card p-6 text-center">
        <p className="font-display text-[20px] text-denim">
          Thank you — we&apos;ll be in touch within 1 business day.
        </p>
        <p className="text-[13px] text-dusk mt-3">
          If your mail app didn&apos;t open, email us directly at{' '}
          <a href={`mailto:${TO}`} className="text-denim underline underline-offset-2">
            {TO}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-card border border-cardBorder rounded-xl3 shadow-card p-6 space-y-4">
      <div>
        <label className={label} htmlFor="cf-name">
          Name
        </label>
        <input id="cf-name" required value={form.name} onChange={set('name')} className={field} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="cf-phone">
            Phone
          </label>
          <input
            id="cf-phone"
            type="tel"
            inputMode="tel"
            required
            value={form.phone}
            onChange={set('phone')}
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="cf-email">
            Email
          </label>
          <input
            id="cf-email"
            type="email"
            inputMode="email"
            required
            value={form.email}
            onChange={set('email')}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="cf-home">
          Tell us about your home
        </label>
        <textarea id="cf-home" rows={5} value={form.home} onChange={set('home')} className={`${field} resize-y`} />
      </div>

      <div>
        <label className={label} htmlFor="cf-heard">
          How did you hear about us?
        </label>
        <input id="cf-heard" value={form.heard} onChange={set('heard')} className={field} />
      </div>

      <button
        type="submit"
        className="w-full bg-denim text-white font-semibold text-[13px] uppercase tracking-[0.12em] py-3.5 rounded-full hover:opacity-90 transition-opacity"
      >
        Send
      </button>
    </form>
  );
}
