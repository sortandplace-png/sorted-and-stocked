// THROWAWAY diagnostic route -- delete immediately after use, do not build
// on top of this. One-shot Twilio credential smoke test for SS-201: calls
// the real sendStaffText() primitive (lib/sms.ts) so the opt-in check,
// Twilio call, and sms_log write are all the exact production code path,
// not a bespoke duplicate. Gated on a disposable one-time header value
// (not a real secret -- this route lives for minutes and is deleted right
// after) so it can't be triggered by anyone who happens to hit the URL
// during its short life.
import { NextResponse } from 'next/server';
import { sendStaffText } from '@/lib/sms';

const NONCE = 'e411cb5a-cea5-4ce9-a1b9-3b5669444484';
const RECIPIENT_USER_ID = 'd4924019-58d1-49ec-97ae-25614e334340';
const PROPERTY_ID = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a';

export async function GET(request: Request) {
  if (request.headers.get('x-test-nonce') !== NONCE) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await sendStaffText({
    propertyId: PROPERTY_ID,
    recipientUserId: RECIPIENT_USER_ID,
    message: 'Sort & Place: one-time Twilio credential test (SS-201). No action needed.',
    trigger: 'broadcast',
    sentBy: RECIPIENT_USER_ID,
  });

  return NextResponse.json(result);
}
