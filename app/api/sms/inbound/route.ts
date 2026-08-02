// POST /api/sms/inbound
// Twilio inbound-SMS webhook (SS-436 both-yes ruling, 2 Aug): staff
// replies to alert texts ("Running late?" responses) land here and are
// stored in sms_replies for the operator console's read-only view.
//
// Twilio posts application/x-www-form-urlencoded with From/Body/MessageSid
// and signs every request with X-Twilio-Signature (HMAC-SHA1 of the exact
// public URL + sorted params, keyed by the auth token). The signature IS
// the auth here -- there is no session -- so a request that fails it is
// rejected before anything is stored. Twilio-side setup (Racquel, one
// field): the phone number's "A message comes in" webhook must point at
// https://app.sortandplace.com/api/sms/inbound (HTTP POST).
//
// Matching: From -> profiles.phone_number -> that user's property
// membership. Unknown numbers are still stored (losing a real reply is
// worse than an orphan row) but stay client-invisible until matched --
// the RLS select policy requires a property_id.
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const WEBHOOK_URL = 'https://app.sortandplace.com/api/sms/inbound';

function validTwilioSignature(params: Record<string, string>, signature: string, authToken: string): boolean {
  const data = WEBHOOK_URL + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Twilio sends E.164 (+18489924053); profiles store the same via
 *  normalizePhoneNumber, but be lenient on stray formatting. */
function last10(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('sms/inbound: TWILIO_AUTH_TOKEN not configured');
    return new NextResponse('Not configured', { status: 500 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = v.toString();
  });

  const signature = request.headers.get('x-twilio-signature') ?? '';
  if (!signature || !validTwilioSignature(params, signature, authToken)) {
    return new NextResponse('Invalid signature', { status: 403 });
  }

  const from = params.From ?? '';
  const body = (params.Body ?? '').trim();
  const sid = params.MessageSid ?? null;
  if (!from || !body) return new NextResponse('Missing From/Body', { status: 400 });

  const admin = createAdminClient();

  // Match sender -> profile -> property membership. If the person belongs
  // to several properties, prefer one with an active shift schedule (the
  // alert context), else the first membership.
  let matchedUserId: string | null = null;
  let propertyId: string | null = null;
  const { data: profiles } = await admin.from('profiles').select('id, phone_number').not('phone_number', 'is', null);
  const sender10 = last10(from);
  const profile = (profiles ?? []).find((p) => p.phone_number && last10(p.phone_number) === sender10);
  if (profile) {
    matchedUserId = profile.id;
    const { data: memberships } = await admin
      .from('property_members')
      .select('property_id')
      .eq('user_id', profile.id);
    propertyId = memberships?.[0]?.property_id ?? null;
    if (memberships && memberships.length > 1) {
      const { data: sched } = await admin
        .from('shift_schedules')
        .select('property_id')
        .eq('staff_user_id', profile.id)
        .eq('active', true)
        .limit(1);
      if (sched?.[0]?.property_id && memberships.some((m) => m.property_id === sched[0].property_id)) {
        propertyId = sched[0].property_id;
      }
    }
  }

  const { error } = await admin.from('sms_replies').insert({
    from_phone: from,
    body,
    twilio_sid: sid,
    matched_user_id: matchedUserId,
    property_id: propertyId,
  });
  // Duplicate webhook retries (same MessageSid) hit the unique constraint
  // -- that is Twilio retrying, not a failure worth a 500 that would make
  // it retry harder.
  if (error && !error.message.includes('duplicate')) {
    console.error('sms/inbound insert failed:', error);
    return new NextResponse('Store failed', { status: 500 });
  }

  // Empty TwiML: acknowledge without auto-replying.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
