// scripts/send-staff-invite.mjs
// Standalone replica of app/api/invite/route.ts's core logic (steps 2-4
// only -- the route's own steps 1/rate-limit exist to protect the public
// HTTP endpoint from an untrusted caller; running this script IS the
// trusted, explicitly-authorized action, so there's no separate caller to
// re-authorize). Same three real effects, in the same order:
//   1. admin.auth.admin.generateLink({ type: 'invite', ... }) -- creates
//      the auth.users row + returns a real action link, without firing
//      Supabase's own default email (that's the whole reason the real app
//      uses generateLink instead of inviteUserByEmail).
//   2. Insert into property_members immediately (not after acceptance).
//   3. Send the same branded HTML email via Resend using that action link.
//
// Usage: node scripts/send-staff-invite.mjs <email> <propertyId> <role>
// role must be 'manager' or 'staff' (matches the route's own validation).
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: 'C:/dev/sorted-and-stocked-files/.env.local' });

const [, , email, propertyId, role] = process.argv;

if (!email || !propertyId || !role) {
  console.error('Usage: node scripts/send-staff-invite.mjs <email> <propertyId> <role>');
  process.exit(1);
}
if (role !== 'manager' && role !== 'staff') {
  console.error('role must be "manager" or "staff"');
  process.exit(1);
}

const RESEND_FROM = 'Sorted & Stocked <invites@sortandplace.com>';
const INVITER_NAME = 'Racquel Schwartz';

function emailShell(title, bodyHtml) {
  return `
  <div style="font-family:Georgia,serif;background:#FAF7F2;padding:24px;max-width:600px;margin:0 auto;">
    <h1 style="color:#2B2B2B;font-size:22px;">${title}</h1>
    ${bodyHtml}
  </div>`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendInviteEmail({ toEmail, inviterName, propertyName, role, actionLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };

  const roleLabel = role === 'manager' ? 'manager / gerente' : 'staff / personal';
  const html = emailShell(
    'You’ve been invited / Has sido invitado',
    `
    <p style="color:#2B2B2B;font-size:15px;">
      ${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(propertyName)}</strong>
      on Sorted &amp; Stocked as <strong>${roleLabel}</strong>.<br/>
      <em>${escapeHtml(inviterName)} te invitó a unirte a <strong>${escapeHtml(
      propertyName
    )}</strong> en Sorted &amp; Stocked como <strong>${roleLabel}</strong>.</em>
    </p>
    <p style="margin:24px 0;">
      <a href="${actionLink}" style="background:#8A6E42;color:#FAF7F2;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
        Accept &amp; set up account / Aceptar y configurar cuenta
      </a>
    </p>
    <p style="color:#2B2B2B99;font-size:12px;">
      If the button doesn't work, copy this link: ${actionLink}<br/>
      Si el botón no funciona, copia este enlace: ${actionLink}
    </p>`
  );

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: toEmail, subject: `You're invited to ${propertyName} on Sorted & Stocked`, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, reason: `Resend returned ${res.status}: ${text.slice(0, 300)}` };
  }
  return { sent: true, reason: null };
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: property, error: propertyError } = await admin
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single();
  if (propertyError || !property) {
    console.error('FAILED to find property:', propertyError?.message ?? 'not found');
    process.exit(1);
  }

  const origin = 'https://sorted-and-stocked.vercel.app';
  const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${origin}/auth/callback?redirectTo=/properties` },
  });

  if (inviteError) {
    const alreadyExists = /already registered|already exists/i.test(inviteError.message);
    console.error(
      'FAILED to create account:',
      alreadyExists ? 'This email already has an account.' : inviteError.message
    );
    process.exit(1);
  }

  const invitedUserId = linkData.user.id;
  console.log(`Account created: ${email} -> ${invitedUserId}`);

  const { error: memberError } = await admin.from('property_members').insert({
    property_id: propertyId,
    user_id: invitedUserId,
    role,
  });

  if (memberError) {
    await admin.auth.admin.deleteUser(invitedUserId).catch(() => {});
    console.error('FAILED to add property membership (account rolled back):', memberError.message);
    process.exit(1);
  }
  console.log(`Added to ${property.name} as ${role}.`);

  const emailResult = await sendInviteEmail({
    toEmail: email,
    inviterName: INVITER_NAME,
    propertyName: property.name,
    role,
    actionLink: linkData.properties.action_link,
  });

  if (!emailResult.sent) {
    console.error(`Account + membership created, but invite EMAIL FAILED: ${emailResult.reason}`);
    process.exit(1);
  }

  console.log(`Invite email sent to ${email}.`);
}

main();
