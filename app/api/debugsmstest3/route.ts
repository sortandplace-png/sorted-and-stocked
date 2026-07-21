// THROWAWAY DIAGNOSTIC ROUTE -- SS-201 retest with distinct To/From, deleted
// after use. From comes from TWILIO_PHONE_NUMBER as configured in Vercel
// (sendStaffText reads it internally, not hardcoded here); To is
// +17189162518, distinct from From, specifically to avoid Twilio error
// 21266 (same number on both sides) hit on the prior attempt.
import { NextResponse } from 'next/server';
import { sendStaffText } from '@/lib/sms';
import { createAdminClient } from '@/lib/supabase/admin';

const NONCE = 'a7e2c9f4-3b1d-4e6a-8f0c-5d9b2a7e4c18';
const PROPERTY_ID = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a'; // Main
const RECIPIENT_USER_ID = 'd4924019-58d1-49ec-97ae-25614e334340'; // Racquel, phone_number set to +17189162518

export async function GET(request: Request) {
  if (request.headers.get('x-debug-nonce') !== NONCE) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const fromConfigured = process.env.TWILIO_PHONE_NUMBER ?? null;

  const result = await sendStaffText({
    propertyId: PROPERTY_ID,
    recipientUserId: RECIPIENT_USER_ID,
    message: 'Sorted & Stocked: SS-201 retest, distinct To/From.',
    trigger: 'broadcast',
    sentBy: RECIPIENT_USER_ID,
  });

  const admin = createAdminClient();
  const { data: logRow } = await admin
    .from('sms_log')
    .select('id, status, error, phone_number, created_at')
    .eq('recipient_user_id', RECIPIENT_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ fromConfigured, result, logRow });
}
