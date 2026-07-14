// app/api/invite/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { emailShell, escapeHtml } from '@/lib/email-template';
import { SITE_URL } from '@/lib/site-url';

const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';

async function sendInviteEmail(opts: {
  toEmail: string;
  inviterName: string;
  propertyName: string;
  role: string;
  actionLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' as const };
  }

  const roleLabel = opts.role === 'manager' ? 'manager / gerente' : 'staff / personal';
  const html = emailShell(
    'You’ve been invited / Has sido invitado',
    `
    <p style="color:#2B2B2B;font-size:15px;">
      ${escapeHtml(opts.inviterName)} invited you to join <strong>${escapeHtml(opts.propertyName)}</strong>
      on Sorted &amp; Stocked as <strong>${roleLabel}</strong>.<br/>
      <em>${escapeHtml(opts.inviterName)} te invitó a unirte a <strong>${escapeHtml(
      opts.propertyName
    )}</strong> en Sorted &amp; Stocked como <strong>${roleLabel}</strong>.</em>
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.actionLink}" style="background:#8A6E42;color:#FAF7F2;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
        Accept &amp; set up account / Aceptar y configurar cuenta
      </a>
    </p>
    <p style="color:#2B2B2B99;font-size:12px;">
      If the button doesn't work, copy this link: ${opts.actionLink}<br/>
      Si el botón no funciona, copia este enlace: ${opts.actionLink}
    </p>`
  );

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: opts.toEmail,
      subject: `You're invited to ${opts.propertyName} on Sorted & Stocked`,
      html,
    }),
  });

  return { sent: res.ok, reason: res.ok ? null : `Resend returned ${res.status}` };
}

export async function POST(request: Request) {
  const { propertyId, email, role } = await request.json();

  if (!propertyId || !email || !role) {
    return NextResponse.json({ error: 'Missing propertyId, email, or role.' }, { status: 400 });
  }
  if (role !== 'manager' && role !== 'staff') {
    return NextResponse.json({ error: 'Invited role must be manager or staff.' }, { status: 400 });
  }

  // Step 1: authenticate the caller and confirm they're an owner/manager of
  // THIS property, using the normal RLS-respecting server client — never
  // trust the request body's propertyId without this check, since the
  // admin client used below bypasses RLS entirely.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json(
      { error: 'Only an owner or manager can invite people to this property.' },
      { status: 403 }
    );
  }

  // 10 invite emails per hour per user — generous for real household use,
  // tight enough to stop a runaway loop or spam from getting far.
  const rateLimit = await checkRateLimit(supabase, 'invite_email', 10, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  // Step 2: create the auth user + get an invite action link. This requires
  // the service-role key, hence the separate admin client.
  //
  // generateLink (not inviteUserByEmail) deliberately -- inviteUserByEmail
  // always fires Supabase's own default templated email with no way to
  // suppress it, which would mean every invite sends TWO emails once a real
  // branded one is added below. generateLink creates the same auth user and
  // returns the action link without sending anything itself, so the branded
  // Resend email below is the only one that goes out.
  const admin = createAdminClient();
  // SITE_URL, not the request's own host -- local dev and production share
  // the same Supabase project, so an invite triggered from someone's local
  // dev server previously produced a real invite email with a localhost
  // link (confirmed: this is what happened to Blimie's invite). The
  // request's host is never the right signal here regardless of forwarded
  // headers, since the recipient's browser has nothing to do with whichever
  // machine happened to call this route.
  const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${SITE_URL}/auth/callback?redirectTo=/properties` },
  });

  if (inviteError) {
    // Supabase returns a specific message when the email is already
    // registered — surface that distinctly so the UI can suggest using
    // the regular (already-has-an-account) invite path instead.
    const alreadyExists = /already registered|already exists/i.test(inviteError.message);
    return NextResponse.json(
      {
        error: alreadyExists
          ? 'This email already has an account. Use the regular invite instead.'
          : inviteError.message,
      },
      { status: 400 }
    );
  }

  const invitedUserId = linkData.user.id;

  // Step 3: add them to property_members now — generateLink creates the
  // auth.users row immediately (the on_auth_user_created trigger from
  // 001_init_schema.sql fires and creates their profiles row too), even
  // though they haven't accepted the invite yet. Use the caller's own
  // RLS-respecting client for this insert — the earlier role check already
  // proved they're allowed to do it, no need for the admin client here.
  const { error: memberError } = await supabase.from('property_members').insert({
    property_id: propertyId,
    user_id: invitedUserId,
    role,
  });

  if (memberError) {
    // The auth user + profile row already exist at this point (created by
    // generateLink above) — without cleanup, a failed membership insert
    // would leave a stranded account with no way to sign into any
    // property. Best-effort: report the original error either way.
    await admin.auth.admin.deleteUser(invitedUserId).catch(() => {});
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  // Step 4: send the real branded invite email via Resend. Best-effort --
  // the account + membership already exist at this point regardless of
  // whether the email send succeeds, so a Resend failure doesn't strand
  // anything; the UI can tell the inviter to share the link manually.
  const [{ data: property }, { data: inviterProfile }] = await Promise.all([
    admin.from('properties').select('name').eq('id', propertyId).single(),
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  const emailResult = await sendInviteEmail({
    toEmail: email,
    inviterName: inviterProfile?.full_name || user.email || 'A household member',
    propertyName: property?.name ?? 'the property',
    role,
    actionLink: linkData.properties.action_link,
  });

  return NextResponse.json({
    status: 'invited',
    userId: invitedUserId,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
  });
}
