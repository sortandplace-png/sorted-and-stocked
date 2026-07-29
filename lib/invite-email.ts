// lib/invite-email.ts
// The staff/manager invite email body.
//
// Lifted out of app/api/invite/route.ts unchanged apart from the TestFlight
// section, so the template can be rendered and looked at without sending
// mail to a real person. The route still owns the sending; this owns only
// the HTML.
import { emailShell, escapeHtml } from '@/lib/email-template';
import { TESTFLIGHT_URL } from '@/lib/testflight';

export function inviteEmailHtml(opts: {
  inviterName: string;
  propertyName: string;
  role: string;
  actionLink: string;
}): string {
  // Two separate label strings, not one combined "staff / personal" --
  // that combined string was previously reused verbatim in BOTH the
  // English and Spanish lines, so each line showed both languages at
  // once instead of just its own.
  const roleLabelEn = opts.role === 'manager' ? 'manager' : 'staff';
  const roleLabelEs = opts.role === 'manager' ? 'gerente' : 'personal';

  return emailShell(
    'You’ve been invited / Has sido invitado',
    `
    <p style="color:#2B2B2B;font-size:15px;">
      ${escapeHtml(opts.inviterName)} invited you to join <strong>${escapeHtml(opts.propertyName)}</strong>
      on Sorted &amp; Stocked as <strong>${roleLabelEn}</strong>.<br/>
      <em>${escapeHtml(opts.inviterName)} te invitó a unirte a <strong>${escapeHtml(
        opts.propertyName
      )}</strong> en Sorted &amp; Stocked como <strong>${roleLabelEs}</strong>.</em>
    </p>
    <p style="margin:24px 0;">
      <a href="${opts.actionLink}" style="display:inline-block;background:#2E4A62;color:#FFFFFF;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;text-align:center;">
        <span style="display:block;">Accept &amp; set up account</span>
        <span style="display:block;font-size:13px;font-weight:500;opacity:.9;">Aceptar y configurar cuenta</span>
      </a>
    </p>
    <p style="color:#2B2B2B99;font-size:12px;">
      If the button doesn't work, copy this link: ${opts.actionLink}<br/>
      Si el botón no funciona, copia este enlace: ${opts.actionLink}
    </p>

    <!-- TestFlight. Placed after the account setup block, not before it:
         the account has to exist before the app is any use, so this is the
         second step and reads as one. Separated by a rule so it is a
         section rather than more fine print.

         The URL is written out in full as visible text rather than hidden
         behind "download the app here" -- invite mail gets forwarded, and
         plain-text fallbacks and locked-down mail clients strip the anchor.
         An unlinked but readable URL is still usable; a bare "here" is not.

         The URL is NOT escaped through escapeHtml because it is our own
         constant, not caller input. -->
    <hr style="border:none;border-top:1px solid #E8DDD0;margin:28px 0 20px;" />
    <p style="color:#2B2B2B;font-size:15px;">
      To access Sorted &amp; Stocked on your iPhone, download the app here:
      <a href="${TESTFLIGHT_URL}" style="color:#2E4A62;font-weight:600;">${TESTFLIGHT_URL}</a><br/>
      <em>Para acceder a Sorted &amp; Stocked en tu iPhone, descarga la app aquí:
      <a href="${TESTFLIGHT_URL}" style="color:#2E4A62;font-weight:600;">${TESTFLIGHT_URL}</a></em>
    </p>
    <p style="color:#2B2B2B99;font-size:12px;">
      Requires the free TestFlight app from the App Store<br/>
      <em>Requiere la app gratuita TestFlight de la App Store</em>
    </p>`
  );
}
