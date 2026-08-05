// app/api/subscribe/unsubscribe/route.ts
// SS-672. Linked from the footer of BOTH emails, per the ruling. Writes
// unsubscribed_at and never deletes the row: R21, and separately the only
// way to keep honouring an opt-out is to remember it.
//
// GET is the human clicking the footer link. POST is the machine path:
// Gmail and Yahoo render their own one-click Unsubscribe button from the
// List-Unsubscribe headers and POST here without ever loading a page. Both
// verbs do the same write, because a mail client that gets a 405 shows the
// reader "report spam" instead.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asSubscribeLocale } from '@/lib/subscribe-emails';
import { verifySubscribeToken } from '@/lib/subscribe-token';

async function optOut(token: string): Promise<{ ok: boolean; locale: 'en' | 'es' }> {
  const email = verifySubscribeToken(token, 'unsubscribe');
  if (!email) return { ok: false, locale: 'en' };

  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from('email_subscribers')
    .select('id, locale')
    .eq('email', email)
    .maybeSingle();

  const locale = asSubscribeLocale(row?.locale);
  if (!row) {
    // No row to mark. The address is not receiving anything, which is what
    // the person asked for, so this is a success from their side.
    return { ok: true, locale };
  }

  // Not conditional on unsubscribed_at being null: re-clicking is
  // harmless, and refreshing the timestamp is more honest than ignoring a
  // second request to stop.
  const { error } = await supabase
    .from('email_subscribers')
    .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', row.id);

  if (error) {
    console.error('subscribe/unsubscribe: could not set unsubscribed_at', error);
    return { ok: false, locale };
  }
  return { ok: true, locale };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const { ok, locale } = await optOut(token);

  const url = new URL('/blog/unsubscribed', request.url);
  url.searchParams.set('state', ok ? 'ok' : 'invalid');
  if (locale === 'es') url.searchParams.set('lang', 'es');
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  // One-click clients send a form body and read only the status code.
  const url = new URL(request.url);
  let token = url.searchParams.get('token') ?? '';

  if (!token) {
    try {
      const form = await request.formData();
      token = form.get('token')?.toString() ?? '';
    } catch {
      // No parseable body. The token is normally in the query string
      // anyway, since that is the URL we put in the header.
    }
  }

  const { ok } = await optOut(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
