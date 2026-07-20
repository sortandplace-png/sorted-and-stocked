// app/api/staff/provision/route.ts
// Manager-only "Add Person" flow (CODE SPEC -- Staff & Owner Account
// Provisioning, 2026-07-20): creates one person and attaches them to one or
// more properties in a single call, supporting two auth modes --
//   A) email invite: same generateLink + branded-email mechanism as the
//      existing single-property /api/invite, just not limited to one
//      property and not treating "already has an account" as an error.
//   B) issued login: manager types a login (doesn't have to be a real
//      inbox, e.g. housekeeper1@sortandplace.app) and a password directly,
//      handed to the person outside the app -- no email is sent.
// Do NOT auto-create accounts or invent emails/logins -- both come from the
// manager's own form input, never generated here.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { emailShell, escapeHtml } from '@/lib/email-template';
import { SITE_URL } from '@/lib/site-url';

const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';
type Role = 'owner' | 'manager' | 'staff';

async function sendProvisionEmail(opts: {
  toEmail: string;
  inviterName: string;
  propertyNames: string[];
  role: Role;
  actionLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' as const };

  const roleLabel = opts.role === 'manager' ? 'manager / gerente' : opts.role === 'owner' ? 'owner / propietario' : 'staff / personal';
  const properties = opts.propertyNames.join(' & ');
  const html = emailShell(
    'You’ve been invited / Has sido invitado',
    `
    <p style="color:#2B2B2B;font-size:15px;">
      ${escapeHtml(opts.inviterName)} invited you to join <strong>${escapeHtml(properties)}</strong>
      on Sorted &amp; Stocked as <strong>${roleLabel}</strong>.<br/>
      <em>${escapeHtml(opts.inviterName)} te invitó a unirte a <strong>${escapeHtml(
      properties
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
      subject: `You're invited to ${properties} on Sorted & Stocked`,
      html,
    }),
  });

  return { sent: res.ok, reason: res.ok ? null : `Resend returned ${res.status}` };
}

export async function POST(request: Request) {
  const { propertyIds, fullName, role, authMode, email, password } = await request.json();

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one property.' }, { status: 400 });
  }
  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  }
  if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  if (authMode !== 'email' && authMode !== 'issued') {
    return NextResponse.json({ error: 'Invalid auth mode.' }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: authMode === 'email' ? 'Email address is required.' : 'Login is required.' }, { status: 400 });
  }
  if (authMode === 'issued' && (!password || password.length < 6)) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Confirm the caller manages every property being requested -- RLS would
  // block the property_members inserts below regardless, but checking here
  // gives a real error message instead of a silent partial success.
  const { data: callerMemberships } = await supabase
    .from('property_members')
    .select('property_id, role')
    .eq('user_id', user.id)
    .in('property_id', propertyIds);

  const manageable = new Set(
    (callerMemberships ?? []).filter((m) => m.role === 'owner' || m.role === 'manager').map((m) => m.property_id)
  );
  const unauthorized = propertyIds.filter((id: string) => !manageable.has(id));
  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: 'You are not an owner or manager on one or more of the selected properties.' },
      { status: 403 }
    );
  }

  const rateLimit = await checkRateLimit(supabase, 'staff_provision', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  const admin = createAdminClient();
  const trimmedEmail = email.trim();

  // Look up by email first via the same narrow, property-scoped RPC the
  // regular invite flow uses -- p_property_id just needs to be ONE property
  // the caller manages (already confirmed above); the function checks that,
  // not which property the target's account might already be on.
  const { data: existingUserId } = await supabase.rpc('get_user_id_by_email', {
    p_email: trimmedEmail,
    p_property_id: propertyIds[0],
  });

  let userId: string;
  let createdNew = false;
  let actionLink: string | null = null;

  if (existingUserId) {
    // Person already has an account -- this call is just attaching them to
    // (more) properties, "without recreating the account" per spec. Neither
    // auth mode applies; email/password fields are ignored for this branch.
    userId = existingUserId;
  } else {
    createdNew = true;
    if (authMode === 'email') {
      const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: trimmedEmail,
        options: {
          redirectTo: `${SITE_URL}/auth/confirm?redirectTo=/reset-password`,
          data: { full_name: fullName.trim() },
        },
      });
      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }
      userId = linkData.user.id;
      actionLink = linkData.properties.action_link;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true, // issued login has no real inbox to confirm from
        user_metadata: { full_name: fullName.trim() },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = created.user.id;
    }
  }

  // Insert per property individually (not one batch insert) so one
  // already-a-member row (23505) doesn't abort attaching the others.
  const added: string[] = [];
  const alreadyMember: string[] = [];
  for (const propertyId of propertyIds) {
    const { error: insertError } = await supabase
      .from('property_members')
      .insert({ property_id: propertyId, user_id: userId, role });
    if (insertError) {
      if (insertError.code === '23505') {
        alreadyMember.push(propertyId);
      } else if (createdNew) {
        // Only a brand-new auth user is stranded by a failed membership
        // insert (an existing user still has whatever memberships they
        // already had) -- same cleanup the single-property invite route
        // uses.
        await admin.auth.admin.deleteUser(userId).catch(() => {});
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    } else {
      added.push(propertyId);
    }
  }

  if (added.length === 0 && alreadyMember.length === propertyIds.length) {
    return NextResponse.json({ error: `${trimmedEmail} is already on every selected property.` }, { status: 400 });
  }

  let emailSent: boolean | undefined;
  let emailReason: string | null | undefined;
  if (createdNew && authMode === 'email' && actionLink) {
    const [{ data: properties }, { data: inviterProfile }] = await Promise.all([
      admin.from('properties').select('name').in('id', added),
      admin.from('profiles').select('full_name').eq('id', user.id).single(),
    ]);
    const result = await sendProvisionEmail({
      toEmail: trimmedEmail,
      inviterName: inviterProfile?.full_name || user.email || 'A household member',
      propertyNames: (properties ?? []).map((p) => p.name),
      role,
      actionLink,
    });
    emailSent = result.sent;
    emailReason = result.reason;
  }

  return NextResponse.json({
    status: 'provisioned',
    userId,
    createdNew,
    added,
    alreadyMember,
    emailSent,
    emailReason,
    // Only meaningful for a brand-new issued-login account -- the one and
    // only time this route ever hands the password back, so the manager can
    // relay it. Never stored in plaintext anywhere after this response.
    issuedLogin: createdNew && authMode === 'issued' ? { login: trimmedEmail, password } : undefined,
  });
}
