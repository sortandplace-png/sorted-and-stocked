// lib/subscribe-mailer.ts
// SERVER-ONLY. The one place a subscriber email is actually sent (SS-672).
//
// Both routes go through here so the suppression check cannot be
// implemented in one of them and forgotten in the other. An unsubscribed
// address that still receives mail is not a bug you find in testing; you
// find it when somebody reports you.
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmailLinkOrigin } from '@/lib/site-url';
import {
  buildConfirmationEmail,
  buildWelcomeEmail,
  GATED_PRINTABLES,
  type SubscribeLocale,
} from '@/lib/subscribe-emails';
import { signDownloadToken, signSubscribeToken } from '@/lib/subscribe-token';

// Matches the other six Resend senders in this codebase. invites@ is the
// verified address on the domain; a new local part would need verifying
// before a single email arrived.
const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';

/**
 * The origin every emailed link is built from. Same rule as auth email
 * links (lib/site-url.ts): a request that happens to arrive from localhost
 * or a Vercel preview must never leak that origin into a real inbox, so
 * anything unrecognised falls back to the production site.
 */
export function emailOrigin(request: Request): string {
  let currentOrigin: string | null = null;
  try {
    currentOrigin = new URL(request.url).origin;
  } catch {
    currentOrigin = null;
  }
  return getEmailLinkOrigin(currentOrigin);
}

export function confirmUrl(origin: string, email: string): string {
  return `${origin}/api/subscribe/confirm?token=${encodeURIComponent(
    signSubscribeToken(email, 'confirm')
  )}`;
}

export function unsubscribeUrl(origin: string, email: string): string {
  return `${origin}/api/subscribe/unsubscribe?token=${encodeURIComponent(
    signSubscribeToken(email, 'unsubscribe')
  )}`;
}

type SendResult = { sent: boolean; reason?: string };

async function deliver(
  to: string,
  subject: string,
  html: string,
  text: string,
  listUnsubscribe: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Loud in the log, quiet to the caller: the row is already saved, and
    // a missing key is an operator problem, not something to surface to
    // the person who just typed their address.
    console.error('subscribe-mailer: RESEND_API_KEY not configured, email not sent to', to);
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject,
        html,
        text,
        // One-click unsubscribe. Gmail and Yahoo have required this on
        // bulk mail since 2024: without it their own UI offers "report
        // spam" as the only exit, and complaints are what actually kill a
        // sending domain. BOTH headers are required -- List-Unsubscribe
        // alone gets a mailto-style confirmation step, and
        // List-Unsubscribe-Post alone is ignored because there is no URL
        // to POST to. The URL is per-recipient, since the token in it is
        // what identifies the address to opt out.
        headers: {
          'List-Unsubscribe': `<${listUnsubscribe}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('subscribe-mailer: Resend rejected the send', res.status, detail);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('subscribe-mailer: Resend request failed', err);
    return { sent: false, reason: 'network' };
  }
}

/**
 * The subscriber row, or null if it cannot be read. Returns the id too,
 * because the download tokens in the welcome email are minted per
 * subscriber (SS-686), not per address.
 */
async function loadSubscriber(
  email: string
): Promise<{ id: string; unsubscribed_at: string | null } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('email_subscribers')
    .select('id, unsubscribed_at')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('subscribe-mailer: subscriber lookup failed', error);
    return null;
  }
  return data ?? null;
}

/**
 * True when this address must not be written to. Fails CLOSED: if we
 * cannot tell whether somebody opted out, not sending is the recoverable
 * mistake.
 */
function suppressed(row: { unsubscribed_at: string | null } | null): boolean {
  if (!row) return true;
  return Boolean(row.unsubscribed_at);
}

export async function sendConfirmationEmail(args: {
  request: Request;
  email: string;
  locale: SubscribeLocale;
}): Promise<SendResult> {
  const { request, email, locale } = args;
  if (suppressed(await loadSubscriber(email))) return { sent: false, reason: 'unsubscribed' };

  const origin = emailOrigin(request);
  const optOut = unsubscribeUrl(origin, email);
  const built = buildConfirmationEmail({
    locale,
    email,
    confirmUrl: confirmUrl(origin, email),
    unsubscribeUrl: optOut,
  });
  return deliver(email, built.subject, built.html, built.text, optOut);
}

export async function sendWelcomeEmail(args: {
  request: Request;
  email: string;
  locale: SubscribeLocale;
}): Promise<SendResult> {
  const { request, email, locale } = args;
  const subscriber = await loadSubscriber(email);
  if (suppressed(subscriber) || !subscriber) return { sent: false, reason: 'unsubscribed' };

  const origin = emailOrigin(request);
  const optOut = unsubscribeUrl(origin, email);

  // SS-686: one signed link per gated printable, each carrying THIS
  // subscriber's id and THAT file's slug. A link is therefore useless for
  // a different file and traceable to the row that earned it.
  const links = GATED_PRINTABLES.map((p) => ({
    label: p[locale],
    href: `${origin}/api/download/${p.slug}?token=${encodeURIComponent(
      signDownloadToken(subscriber.id, p.slug)
    )}`,
  }));

  const built = buildWelcomeEmail({
    locale,
    email,
    links,
    unsubscribeUrl: optOut,
  });
  return deliver(email, built.subject, built.html, built.text, optOut);
}
