// app/api/download/[slug]/route.ts
// SS-686. The ONLY path to a gated printable.
//
// The bytes live in the private 'printables' bucket (migration 190), which
// has public = false and no read policy at all. That is deliberate and it
// is the actual gate: a file in public/ is served as a static asset before
// any route, middleware or session runs, so nothing can be put in front of
// it. Moving the bytes is the fix; this route is just the door.
//
// The 24 ReportLab stubs in public/downloads stay public and are not
// touched here. Gating those is phase C, not due until 1 September.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyDownloadToken } from '@/lib/subscribe-token';
import { GATED_PRINTABLES } from '@/lib/subscribe-emails';

// A signed Storage URL long enough to survive a mail client opening it in
// its own browser, short enough that a forwarded link is not a
// distribution channel.
const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const token = new URL(request.url).searchParams.get('token') ?? '';

  // Where an unauthorised visitor goes. Never a 403, and never anything
  // that repeats the filename back: a 403 saying "reset-day.pdf is
  // protected" confirms the file exists and names it, which is the one
  // thing a bare 302 to the request page does not do.
  const requestPage = new URL('/blog', request.url);

  const printable = GATED_PRINTABLES.find((p) => p.slug === slug);
  if (!printable) return NextResponse.redirect(requestPage);

  // Rejects missing, malformed, forged, expired, wrong-purpose, AND
  // wrong-file tokens. The slug is inside the signed body, so a token
  // minted for reset-day fails here when replayed at training-staff.
  const subscriberId = verifyDownloadToken(token, slug);
  if (!subscriberId) return NextResponse.redirect(requestPage);

  const supabase = createAdminClient();

  // The token proves who minted it, not that they are still entitled.
  // Someone who unsubscribed should stop being able to pull files with an
  // old link, and a deleted row should not resolve at all.
  const { data: subscriber, error: lookupError } = await supabase
    .from('email_subscribers')
    .select('id, confirmed_at, unsubscribed_at')
    .eq('id', subscriberId)
    .maybeSingle();

  if (lookupError || !subscriber) return NextResponse.redirect(requestPage);
  if (!subscriber.confirmed_at || subscriber.unsubscribed_at) {
    return NextResponse.redirect(requestPage);
  }

  // A short-lived signed URL, minted server side. The service key never
  // leaves this process: what reaches the browser is a URL that expires,
  // scoped to one object.
  const { data: signed, error: signError } = await supabase.storage
    .from('printables')
    .createSignedUrl(printable.file, SIGNED_URL_TTL_SECONDS, { download: printable.file });

  if (signError || !signed?.signedUrl) {
    // Reaches here when the object is not in the bucket yet, which is the
    // live state for the two printables still in defect on SS-685/687.
    console.error('download: could not sign', printable.file, signError);
    return NextResponse.redirect(requestPage);
  }

  return NextResponse.redirect(signed.signedUrl);
}
