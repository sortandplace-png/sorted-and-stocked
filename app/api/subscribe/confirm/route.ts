// app/api/subscribe/confirm/route.ts
// SS-672. The link in the confirmation email lands here. Sets confirmed_at
// and sends the welcome email carrying the four printables, then puts the
// reader on a real page rather than leaving them looking at JSON.
//
// Public and unauthenticated by necessity: somebody confirming a blog
// subscription has no account and never will. Under app/api, which
// middleware excludes wholesale, so this is not 307'd to /login the way
// /downloads was before SS-569.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asSubscribeLocale } from '@/lib/subscribe-emails';
import { sendWelcomeEmail } from '@/lib/subscribe-mailer';
import { verifySubscribeToken } from '@/lib/subscribe-token';

function landing(request: Request, status: 'ok' | 'invalid' | 'unsubscribed', locale: string) {
  const url = new URL('/blog/subscribed', request.url);
  url.searchParams.set('state', status);
  if (locale === 'es') url.searchParams.set('lang', 'es');
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const email = verifySubscribeToken(token, 'confirm');

  if (!email) {
    // Forged, edited, or older than the token lifetime. One message for
    // all three: which one it was is not something to tell the sender of a
    // forged link, and the recovery for an honest reader is the same
    // either way, which is to sign up again.
    return landing(request, 'invalid', 'en');
  }

  const supabase = createAdminClient();

  const { data: row, error: lookupError } = await supabase
    .from('email_subscribers')
    .select('id, locale, confirmed_at, unsubscribed_at')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('subscribe/confirm: lookup failed', lookupError);
    return landing(request, 'invalid', 'en');
  }
  if (!row) {
    // Signed token, no row. Only reachable if the row was deleted between
    // the send and the click.
    return landing(request, 'invalid', 'en');
  }

  const locale = asSubscribeLocale(row.locale);

  // Somebody who opted out and then clicks an older confirmation link must
  // not be quietly resubscribed by it. Signing up again is the way back
  // in, and that path clears unsubscribed_at deliberately.
  if (row.unsubscribed_at) {
    return landing(request, 'unsubscribed', locale);
  }

  // ATOMIC transition, and the reason the welcome email cannot be sent
  // twice. The .is('confirmed_at', null) filter means exactly one caller
  // can move this row from unconfirmed to confirmed; every later click
  // matches zero rows and returns an empty array. This is not a
  // theoretical race: Gmail, Outlook and most corporate scanners fetch
  // links in mail before a human ever clicks, so this route is routinely
  // called more than once for one signup.
  const { data: transitioned, error: updateError } = await supabase
    .from('email_subscribers')
    .update({ confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('confirmed_at', null)
    .select('id');

  if (updateError) {
    console.error('subscribe/confirm: could not set confirmed_at', updateError);
    return landing(request, 'invalid', locale);
  }

  const justConfirmed = Array.isArray(transitioned) && transitioned.length > 0;
  if (justConfirmed) {
    await sendWelcomeEmail({ request, email, locale });
  }

  // Already-confirmed clicks land on the same page. To the reader there is
  // no difference between confirming and having confirmed, and there
  // should not be.
  return landing(request, 'ok', locale);
}
