// app/api/billing/send-payment-link/route.ts
// Owner/manager-triggered "prompt the owner to pay" step for Sort & Place's
// own subscription billing. Never generates or guesses a Square link -- it
// only ever sends whatever link an owner/manager already pasted into
// Settings (properties.square_payment_link). Fans out to every owner-role
// member on the property, same "don't silently pick just one" shape as the
// shift_handover SMS trigger in /api/sms/send.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendStaffText } from '@/lib/sms';
import { emailShell, escapeHtml } from '@/lib/email-template';

const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';

async function sendPaymentEmail(opts: { toEmail: string; propertyName: string; paymentLink: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' as const };

  const html = emailShell(
    'Your Sort &amp; Place subscription payment',
    `
    <p style="color:#2B2B2B;font-size:15px;">
      This is your monthly subscription payment for <strong>${escapeHtml(opts.propertyName)}</strong> on Sort &amp; Place.
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.paymentLink}" style="background:#2E4A62;color:#FFFFFF;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
        Pay now
      </a>
    </p>
    <p style="color:#2B2B2B99;font-size:12px;">
      If the button doesn't work, copy this link: ${opts.paymentLink}
    </p>`
  );

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: opts.toEmail,
      subject: `Payment due -- ${opts.propertyName} on Sort & Place`,
      html,
    }),
  });

  return { sent: res.ok, reason: res.ok ? null : `Resend returned ${res.status}` };
}

export async function POST(request: Request) {
  const { propertyId, channel } = await request.json();

  if (!propertyId) return NextResponse.json({ error: 'Missing propertyId.' }, { status: 400 });
  if (channel !== 'email' && channel !== 'sms') {
    return NextResponse.json({ error: 'Invalid channel.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json({ error: 'Only an owner or manager can send this.' }, { status: 403 });
  }

  const { data: property } = await supabase
    .from('properties')
    .select('name, square_payment_link')
    .eq('id', propertyId)
    .single();
  if (!property?.square_payment_link) {
    return NextResponse.json({ error: 'No payment link set for this property yet.' }, { status: 400 });
  }

  const { data: owners } = await supabase
    .from('property_members')
    .select('user_id')
    .eq('property_id', propertyId)
    .eq('role', 'owner');
  if (!owners || owners.length === 0) {
    return NextResponse.json({ error: 'No owner found on this property.' }, { status: 400 });
  }

  let results: { sent: boolean; reason?: string | null }[];

  if (channel === 'sms') {
    results = await Promise.all(
      owners.map((o) =>
        sendStaffText({
          propertyId,
          recipientUserId: o.user_id,
          message: `${property.name}: your Sort & Place subscription payment is due. Pay here: ${property.square_payment_link}`,
          trigger: 'payment_reminder',
          sentBy: user.id,
        })
      )
    );
  } else {
    const admin = createAdminClient();
    results = await Promise.all(
      owners.map(async (o) => {
        const { data: ownerAuth } = await admin.auth.admin.getUserById(o.user_id);
        if (!ownerAuth?.user?.email) return { sent: false, reason: 'Owner has no email on file' };
        return sendPaymentEmail({
          toEmail: ownerAuth.user.email,
          propertyName: property.name,
          paymentLink: property.square_payment_link!,
        });
      })
    );
  }

  const sentCount = results.filter((r) => r.sent).length;

  // Only mark it "sent" if delivery actually happened for at least one
  // owner -- the whole point is making sure it doesn't sit unseen, so an
  // all-failed attempt (e.g. Twilio not configured) shouldn't read as done.
  if (sentCount > 0) {
    await supabase
      .from('properties')
      .update({ square_payment_link_sent_at: new Date().toISOString(), square_payment_link_sent_via: channel })
      .eq('id', propertyId);
  }

  return NextResponse.json({
    sent: sentCount,
    total: results.length,
    reason: sentCount === 0 ? results[0]?.reason ?? 'Send failed' : null,
  });
}
