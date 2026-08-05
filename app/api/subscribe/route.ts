// app/api/subscribe/route.ts
// SS-672. Public, unauthenticated. This route REPLACES the browser insert
// that components/blog/SubscribeForm.tsx used to do directly.
//
// Why the insert moved off the client, given the old comment there argued
// the opposite: the table's RLS is a good guard on WHO may write, and it
// is not a place to put a confirmation email. Everything this feature
// actually needs happens after the row lands -- mint a signed token, send
// in the reader's language, resend rather than error for somebody signing
// up twice -- and none of that can run in a browser holding an anon key.
// The old design was not wrong about drift; it was answering a smaller
// question than the one SS-672 asks.
//
// The table constraints stay exactly as they are and are still the last
// word. This route validates the same shape early so a reader gets a
// sentence instead of a constraint violation, not so the check can move.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asSubscribeLocale } from '@/lib/subscribe-emails';
import { sendConfirmationEmail } from '@/lib/subscribe-mailer';

// Same expression as email_subscribers_email_shape on the table.
function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// A person cannot read the line, type an address and submit this fast.
// Mirrors the client-side check in SubscribeForm, because a check that
// only exists in the browser is a check a script skips by posting here
// directly.
const MIN_SECONDS_ON_FORM = 3;

export async function POST(request: Request) {
  let body: {
    email?: string;
    source?: string;
    sourceDetail?: string;
    locale?: string;
    company?: string;
    elapsedMs?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const source = body.source?.trim() || 'blog';
  const sourceDetail = body.sourceDetail?.trim() || null;
  const locale = asSubscribeLocale(body.locale);

  // Honeypot and time-on-form. Answered as success on purpose: telling a
  // bot which check caught it is telling whoever wrote it how to pass.
  const trippedBotCheck =
    (typeof body.company === 'string' && body.company !== '') ||
    (typeof body.elapsedMs === 'number' && body.elapsedMs < MIN_SECONDS_ON_FORM * 1000);
  if (trippedBotCheck) {
    return NextResponse.json({ ok: true });
  }

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // IP-keyed: there is no session here to key against. x-forwarded-for can
  // carry a comma-separated proxy chain; the first entry is the client.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    'check_and_record_anon_rate_limit',
    {
      p_identifier: ip,
      p_action: 'subscribe',
      p_max_count: 5,
      p_window_seconds: 3600,
    }
  );
  if (rateLimitError || !allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // Dedupe. Read before write, because all three existing-row cases have
  // different correct behaviour and none of them is an error to the
  // person typing.
  const { data: existing, error: lookupError } = await supabase
    .from('email_subscribers')
    .select('id, confirmed_at, unsubscribed_at, locale')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('subscribe: lookup failed', lookupError);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }

  if (existing) {
    // ALREADY CONFIRMED. Success, and deliberately no second email: a
    // confirmed subscriber who resubmits should not be able to be used to
    // mail-bomb an address that is already on the list.
    if (existing.confirmed_at && !existing.unsubscribed_at) {
      return NextResponse.json({ ok: true });
    }

    // PREVIOUSLY UNSUBSCRIBED, now signing up again. Typing the address
    // into the form a second time is fresh consent, so the opt-out is
    // cleared and they go back through confirmation from the start rather
    // than being silently suppressed forever.
    //
    // Also refresh locale: somebody who signed up in English and is now on
    // the Spanish site should get Spanish.
    const { error: reviveError } = await supabase
      .from('email_subscribers')
      .update({
        unsubscribed_at: null,
        confirmed_at: null,
        locale,
        source,
        source_detail: sourceDetail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (reviveError) {
      console.error('subscribe: could not reset existing row', reviveError);
      return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
    }

    // UNCONFIRMED (either always was, or just reset above): resend the
    // confirmation rather than erroring. The first one gets lost, filtered
    // or deleted often enough that "you already signed up" is a dead end.
    await sendConfirmationEmail({ request, email, locale });
    return NextResponse.json({ ok: true });
  }

  const { error: insertError } = await supabase.from('email_subscribers').insert({
    email,
    source,
    source_detail: sourceDetail,
    locale,
    // Explicit, not merely omitted. confirmed_at is the whole gate: it
    // stays NULL until the link in the email is clicked, and nothing but
    // the confirmation email may be sent before that.
    confirmed_at: null,
  });

  if (insertError) {
    // 23505 is the unique violation on email. Only reachable if two
    // submissions for the same new address race between the lookup above
    // and this insert; the loser is a duplicate signup, which is a success
    // to the person who typed it.
    if (insertError.code === '23505') {
      await sendConfirmationEmail({ request, email, locale });
      return NextResponse.json({ ok: true });
    }
    console.error('subscribe: insert failed', insertError);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }

  // The row is saved before the send is attempted, same as
  // consultation-request: a Resend hiccup must never lose a real signup.
  // A failure here is logged, and the reader is told to check their inbox
  // either way, because the recovery is the same in both cases: sign up
  // again, which resends.
  await sendConfirmationEmail({ request, email, locale });

  return NextResponse.json({ ok: true });
}
