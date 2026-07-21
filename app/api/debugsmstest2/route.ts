// THROWAWAY DIAGNOSTIC ROUTE -- SS-201 real credential test, deleted after use.
// Nonce is not a real secret, just prevents accidental/drive-by triggering
// during this route's brief live window.
import { NextResponse } from 'next/server';
import { sendStaffText } from '@/lib/sms';
import { createAdminClient } from '@/lib/supabase/admin';

const NONCE = 'f3a9c1e2-7b6d-4e0a-9c5f-2d8b6a1e4f70';
const PROPERTY_ID = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a'; // Main
const RECIPIENT_USER_ID = 'd4924019-58d1-49ec-97ae-25614e334340'; // Racquel

export async function GET(request: Request) {
  if (request.headers.get('x-debug-nonce') !== NONCE) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const result = await sendStaffText({
    propertyId: PROPERTY_ID,
    recipientUserId: RECIPIENT_USER_ID,
    message: 'Sorted & Stocked: SS-201 Twilio credential test send.',
    trigger: 'broadcast',
    sentBy: RECIPIENT_USER_ID,
  });

  const admin = createAdminClient();
  const { data: logRow } = await admin
    .from('sms_log')
    .select('id, status, error, created_at')
    .eq('recipient_user_id', RECIPIENT_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ result, logRow });
}
