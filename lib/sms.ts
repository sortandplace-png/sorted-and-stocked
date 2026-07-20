// lib/sms.ts
// SERVER-ONLY. TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER must
// never reach the browser — only call this from Route Handlers, never from
// a 'use client' component. Same raw-fetch convention as lib/anthropic/client.ts
// and the Resend call in app/api/invite/route.ts — no Twilio SDK dependency
// needed for one endpoint.
import { createAdminClient } from '@/lib/supabase/admin';

export type SmsTrigger = 'task_assigned' | 'shift_handover' | 'broadcast' | 'payment_reminder';

type SendStaffTextResult = { sent: true } | { sent: false; reason: string };

// Always checks sms_opt_in before sending, no exceptions -- callers pass a
// user id, never a raw phone number, specifically so this check can never
// be bypassed by a caller that already "knows" the number.
export async function sendStaffText(opts: {
  propertyId: string;
  recipientUserId: string;
  message: string;
  trigger: SmsTrigger;
  sentBy?: string | null;
}): Promise<SendStaffTextResult> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('phone_number, sms_opt_in')
    .eq('id', opts.recipientUserId)
    .maybeSingle();

  if (!profile?.phone_number || !profile.sms_opt_in) {
    // Not an error -- this is the expected, silent outcome for anyone who
    // hasn't opted in. Nothing to log: no send was ever attempted.
    return { sent: false, reason: 'not opted in' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, reason: 'Twilio not configured' };
  }

  let status: 'sent' | 'failed' = 'sent';
  let error: string | null = null;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: profile.phone_number, From: fromNumber, Body: opts.message }),
    });
    if (!res.ok) {
      status = 'failed';
      const body = await res.text();
      error = `Twilio returned ${res.status}: ${body}`;
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : 'Unknown network error';
  }

  // Logged regardless of outcome -- a failed send is exactly the kind of
  // thing this audit trail exists to surface, not just successes.
  await admin.from('sms_log').insert({
    property_id: opts.propertyId,
    recipient_user_id: opts.recipientUserId,
    phone_number: profile.phone_number,
    message: opts.message,
    trigger: opts.trigger,
    sent_by: opts.sentBy ?? null,
    status,
    error,
  });

  return status === 'sent' ? { sent: true } : { sent: false, reason: error ?? 'Twilio send failed' };
}
