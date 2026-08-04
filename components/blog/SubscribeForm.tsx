// components/blog/SubscribeForm.tsx
// SS-630: blog sign-up. The blog stays OPEN -- this is opt-in, never a
// gate on reading (Racquel's ruling: "i want the blog to be open and
// people should sign up to get updates").
//
// Writes straight to public.email_subscribers with the anon key, which is
// exactly what that table's RLS was built for: anon may INSERT and
// nothing else, so the public can join the list and cannot read or
// enumerate it. No API route in front of it -- an endpoint would add a
// second place for the rules to drift from the table that already
// enforces them (unique, lowercased, shape-checked).
//
// confirmed_at is deliberately NOT set here. It stays NULL until the
// confirmation link is clicked, and nothing but the confirmation email
// may be sent before that. The send itself is NOT built yet: it waits on
// Racquel's ruling on which printable leads and on SS-575, because the
// four existing PDFs do not open on her phone and a printable that fails
// on a phone fails for most readers.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SubscribeForm({
  source = 'blog',
  sourceDetail,
  heading = 'Get new posts by email',
  blurb = 'Notes on running a real household, when we publish them. No more than that.',
}: {
  source?: string;
  /** Which post or surface the sign-up came from, for attribution. */
  sourceDetail?: string;
  heading?: string;
  blurb?: string;
}) {
  const [email, setEmail] = useState('');
  // SS-630 spam protection. The consultation form took two bot
  // submissions on its first live day with nothing guarding it, and
  // email_subscribers has the same open-insert shape -- so this form
  // does not go out without these. A list full of bot addresses is
  // worse than an empty one: it wrecks sending reputation, and then
  // confirmation emails to real people stop arriving.
  //
  // Two checks that cost a real person nothing:
  //  1. HONEYPOT -- a field no human sees. Bots fill every input they
  //     find; a non-empty value here is a bot, and we answer with the
  //     same success message rather than telling it what tripped.
  //  2. TIME ON FORM -- a human cannot read the blurb, type an address
  //     and submit in under MIN_SECONDS. Scripted posts are instant.
  // Rate limiting per address and per IP is NOT here: it cannot be
  // enforced in a browser, and the honest place for it is the database
  // or an edge rule. Flagged on the row rather than faked here.
  const [botField, setBotField] = useState('');
  const mountedAt = useRef<number>(0);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;

    const secondsOnForm = (Date.now() - mountedAt.current) / 1000;
    const MIN_SECONDS = 3;
    if (botField !== '' || secondsOnForm < MIN_SECONDS) {
      // Deliberately indistinguishable from success: telling a bot which
      // check caught it is telling whoever wrote it how to pass.
      setState('done');
      setMessage("Thanks. Check your email to confirm — nothing else is sent until you do.");
      return;
    }

    setState('sending');

    const supabase = createClient();
    const { error } = await supabase.from('email_subscribers').insert({
      email: value,
      source,
      source_detail: sourceDetail ?? null,
      locale: 'en',
    });

    if (error) {
      // 23505 is the unique violation. Someone signing up twice is not an
      // error to them -- and saying "already on the list" to an arbitrary
      // address would leak membership of a list the public cannot read,
      // so both cases get the same reassuring answer.
      if (error.code === '23505') {
        setState('done');
        setMessage("You're on the list. Check your email to confirm.");
        return;
      }
      setState('error');
      setMessage('That did not go through. Try again in a moment.');
      return;
    }

    setState('done');
    setMessage("Thanks. Check your email to confirm — nothing else is sent until you do.");
  }

  if (state === 'done') {
    return (
      <div className="bg-mist border border-brass/30 rounded-xl2 px-5 py-4">
        <p className="text-sm text-denim">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative bg-mist border border-brass/30 rounded-xl2 px-5 py-4">
      <p className="font-display text-[17px] text-denim">{heading}</p>
      <p className="text-[13px] text-dusk mt-0.5 mb-3">{blurb}</p>
      {/* Honeypot. Hidden from people and from screen readers, left in
          the tab order's dead zone; only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
        <label htmlFor="subscribe-company">Company</label>
        <input
          id="subscribe-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={botField}
          onChange={(e) => setBotField(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="subscribe-email" className="sr-only">
          Email address
        </label>
        <input
          id="subscribe-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 bg-card border border-cardBorder rounded-xl2 px-4 py-2.5 text-sm text-denim placeholder:text-denim/40 focus:outline-none focus:ring-1 focus:ring-denim/40"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="bg-denim text-white text-sm font-medium px-5 py-2.5 rounded-xl2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {state === 'sending' ? 'Signing up…' : 'Sign up'}
        </button>
      </div>
      {state === 'error' && <p className="text-[13px] text-rust mt-2">{message}</p>}
    </form>
  );
}
