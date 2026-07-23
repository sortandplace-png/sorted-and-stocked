// app/api/request-access/route.ts
// Public, unauthenticated endpoint fed by the /welcome marketing page's
// "Request Early Access" form. Stores the submission (migration 088)
// before attempting the email, so a Resend hiccup never loses a real lead.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';
const NOTIFY_TO = 'sortandplace@gmail.com';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: { name?: string; email?: string; city?: string };
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // The landing page posts a real <form> via fetch(form.action, { body:
      // new FormData(form) }) -- multipart, not JSON.
      const form = await request.formData();
      body = {
        name: form.get('name')?.toString(),
        email: form.get('email')?.toString(),
        city: form.get('city')?.toString(),
      };
    }
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const city = body.city?.trim() || null;

  if (!name || !email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'A real name and email address are required.' }, { status: 400 });
  }

  // Service-role client, not the request-scoped server helper -- this route
  // has no signed-in user (prospective households don't have accounts yet).
  const supabase = createAdminClient();

  const { error: insertError } = await supabase.from('access_requests').insert({ name, email, city });
  if (insertError) {
    console.error('access_requests insert failed:', insertError);
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
          subject: `New early access request — ${name}`,
          html: `<p>New request from the marketing page:</p><ul><li><b>Name:</b> ${name}</li><li><b>Email:</b> ${email}</li><li><b>City:</b> ${city ?? '(not given)'}</li></ul>`,
        }),
      });
    } catch (err) {
      // The submission is already saved in access_requests -- a failed
      // notification email is a real gap to check on, not a reason to tell
      // the person who just submitted that it failed.
      console.error('request-access notification email failed:', err);
    }
  } else {
    console.error('RESEND_API_KEY not configured -- request-access notification not sent (submission still saved)');
  }

  return NextResponse.json({ ok: true });
}
