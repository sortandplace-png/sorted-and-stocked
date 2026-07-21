// app/api/consultation-request/route.ts
// Public, unauthenticated endpoint fed by the root (/) marketing page's
// "Book Your Consultation" form. Stores the submission (migration 121)
// before attempting the email, so a Resend hiccup never loses a real lead --
// same pattern as app/api/request-access/route.ts.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const RESEND_FROM = 'Sort + Place <invites@sortandplace.com>';
const NOTIFY_TO = 'sortandplace@gmail.com';

const VALID_SERVICES = new Set([
  'Full Home Organization',
  'Kitchen/Pantry Setup',
  'Newlywed Package',
  'Household Operations/Staff Management',
]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: { name?: string; phone?: string; email?: string; serviceInterest?: string[]; notes?: string };
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {
        name: form.get('name')?.toString(),
        phone: form.get('phone')?.toString(),
        email: form.get('email')?.toString(),
        serviceInterest: form.getAll('serviceInterest').map((v) => v.toString()),
        notes: form.get('notes')?.toString(),
      };
    }
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim();
  const notes = body.notes?.trim() || null;
  // Only ever store the 4 known service options -- silently drops anything
  // else rather than erroring, since this is just belt-and-suspenders
  // against a tampered client request, not a real user-facing validation.
  const serviceInterest = (body.serviceInterest ?? []).filter((s) => VALID_SERVICES.has(s));

  if (!name || !phone || !email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A real name, phone number, and email address are required.' }, { status: 400 });
  }

  // Service-role client, not the request-scoped server helper -- this route
  // has no signed-in user (prospective clients don't have accounts yet).
  const supabase = createAdminClient();

  const { error: insertError } = await supabase
    .from('consultation_requests')
    .insert({ name, phone, email, service_interest: serviceInterest, notes });
  if (insertError) {
    console.error('consultation_requests insert failed:', insertError);
    return NextResponse.json({ error: "Couldn't save your request — try again in a moment." }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: NOTIFY_TO,
          subject: `New consultation request — ${name}`,
          html: `<p>New consultation request from the marketing page:</p><ul><li><b>Name:</b> ${name}</li><li><b>Phone:</b> ${phone}</li><li><b>Email:</b> ${email}</li><li><b>Interested in:</b> ${serviceInterest.join(', ') || '(none selected)'}</li><li><b>Notes:</b> ${notes ?? '(none)'}</li></ul>`,
        }),
      });
    } catch (err) {
      // The submission is already saved in consultation_requests -- a
      // failed notification email is a real gap to check on, not a reason
      // to tell the person who just submitted that it failed.
      console.error('consultation-request notification email failed:', err);
    }
  } else {
    console.error('RESEND_API_KEY not configured -- consultation-request notification not sent (submission still saved)');
  }

  return NextResponse.json({ ok: true });
}
