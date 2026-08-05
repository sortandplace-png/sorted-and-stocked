// components/blog/SubscribeForm.tsx
// SS-630: blog sign-up. The blog stays OPEN -- this is opt-in, never a
// gate on reading (Racquel's ruling: "i want the blog to be open and
// people should sign up to get updates").
//
// SS-672: this form POSTs to /api/subscribe. It used to insert straight
// into public.email_subscribers with the anon key, and the argument for
// that (the table's RLS is the real guard, an endpoint is a second place
// for the rules to drift) was answering a smaller question than the one
// that mattered. A browser holding an anon key cannot mint a signed
// confirmation token, cannot send in the reader's language, and cannot
// tell a first-time signup from somebody whose confirmation email got
// filtered. Nobody who signed up received anything, for exactly that
// reason. The table's constraints are untouched and are still the last
// word; the route validates the same shape early so a reader gets a
// sentence instead of a constraint violation.
//
// confirmed_at is still NULL at insert. It stays NULL until the link in
// the confirmation email is clicked, and nothing but that email may be
// sent before it.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

// SS-666: no em dashes in marketing copy, and this form is marketing copy.
// The full stop that replaced the dash here is the ruling, not a
// preference. Both strings ship EN and ES together (SS-672) rather than
// English now and Spanish later.
const DONE_MESSAGE = {
  en: 'Thanks. Check your email to confirm. Nothing else is sent until you do.',
  es: 'Gracias. Revisa tu correo para confirmar. No se envía nada más hasta que lo hagas.',
} as const;

const ERROR_MESSAGE = {
  en: 'That did not go through. Try again in a moment.',
  es: 'No se pudo enviar. Inténtalo de nuevo en un momento.',
} as const;

export default function SubscribeForm({
  source = 'blog',
  sourceDetail,
  heading = 'Get new posts by email',
  blurb = 'Notes on running a real household, when we publish them. No more than that.',
  variant = 'panel',
  line = 'New posts by email, when we publish them.',
}: {
  source?: string;
  /** Which post or surface the sign-up came from, for attribution. */
  sourceDetail?: string;
  heading?: string;
  blurb?: string;
  /**
   * SS-639. 'panel' is the original card. 'inline' is Racquel's ruling for
   * the foot of an article: ONE line of type and a field, not a headline
   * plus a subheading to collect one address. The article foot already
   * carries the real ask (Book Your Consultation); this sits under it and
   * must stay quieter than it, or there are two asks competing.
   */
  variant?: 'panel' | 'inline';
  /** The single line of type, inline variant only. */
  line?: string;
}) {
  // The reader's language, from the sns_locale cookie via next-intl. Sent
  // to the route so the confirmation email arrives in it, and used for
  // this form's own two messages.
  const locale = useLocale();
  const copyLocale: 'en' | 'es' = locale === 'es' ? 'es' : 'en';

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
  // Both are ALSO checked server-side in /api/subscribe now, because a
  // check that only exists in the browser is one a script skips by
  // posting to the route directly. These stay as the fast path.
  // Rate limiting per IP is no longer missing either: it moved to the
  // route, where it can actually be enforced (SS-672).
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

    const elapsedMs = Date.now() - mountedAt.current;
    const MIN_SECONDS = 3;
    if (botField !== '' || elapsedMs < MIN_SECONDS * 1000) {
      // Deliberately indistinguishable from success: telling a bot which
      // check caught it is telling whoever wrote it how to pass.
      setState('done');
      setMessage(DONE_MESSAGE[copyLocale]);
      return;
    }

    setState('sending');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: value,
          source,
          sourceDetail: sourceDetail ?? null,
          // The reader's own language, not a hardcoded 'en'. locale has
          // always been NOT NULL on the table and every row was being
          // written as English regardless of which site they were on.
          locale,
          // Echoed so the route can run the same two bot checks.
          company: botField,
          elapsedMs,
        }),
      });

      if (!res.ok) {
        setState('error');
        setMessage(ERROR_MESSAGE[copyLocale]);
        return;
      }
    } catch {
      // Offline, or the request never left. Same recovery either way.
      setState('error');
      setMessage(ERROR_MESSAGE[copyLocale]);
      return;
    }

    // One message for every success case. The route answers the same way
    // for a new signup, a resend and an address already on the list, so
    // this cannot leak whether a given address is a member of a list the
    // public is not allowed to read.
    setState('done');
    setMessage(DONE_MESSAGE[copyLocale]);
  }

  // The honeypot travels with BOTH variants. It is the spam guard, not
  // decoration -- shipping the inline one without it would reopen the gap
  // that PR #76 closed.
  const honeypot = (
    <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
      <label htmlFor={`subscribe-company-${variant}`}>Company</label>
      <input
        id={`subscribe-company-${variant}`}
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={botField}
        onChange={(e) => setBotField(e.target.value)}
      />
    </div>
  );

  if (state === 'done') {
    return variant === 'inline' ? (
      <p className="text-[13px] text-dusk mt-6 pt-5 border-t border-cardBorder">{message}</p>
    ) : (
      <div className="bg-mist border border-brass/30 rounded-xl2 px-5 py-4">
        <p className="text-sm text-denim">{message}</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={onSubmit} className="relative mt-6 pt-5 border-t border-cardBorder">
        {honeypot}
        <p className="text-[13px] text-dusk mb-2.5">{line}</p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <label htmlFor="subscribe-email-inline" className="sr-only">
            Email address
          </label>
          <input
            id="subscribe-email-inline"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 bg-card border border-cardBorder rounded-xl2 px-4 py-2 text-sm text-denim placeholder:text-denim/40 focus:outline-none focus:ring-1 focus:ring-denim/40"
          />
          {/* Deliberately NOT the denim fill the consultation button uses:
              two solid buttons stacked would read as two equal asks. */}
          <button
            type="submit"
            disabled={state === 'sending'}
            className="border border-cardBorder text-denim text-sm font-medium px-5 py-2 rounded-xl2 hover:border-brass transition-colors disabled:opacity-60"
          >
            {state === 'sending' ? 'Signing up…' : 'Sign up'}
          </button>
        </div>
        {state === 'error' && <p className="text-[13px] text-rust mt-2">{message}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative bg-mist border border-brass/30 rounded-xl2 px-5 py-4">
      <p className="font-display text-[17px] text-denim">{heading}</p>
      <p className="text-[13px] text-dusk mt-0.5 mb-3">{blurb}</p>
      {/* Honeypot. Hidden from people and from screen readers, left in
          the tab order's dead zone; only a bot fills it. */}
      {honeypot}

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
