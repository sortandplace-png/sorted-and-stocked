// lib/site-url.ts
// The one, fixed source of truth for auth-email redirect links
// (resetPasswordForEmail, generateLink, inviteUserByEmail). These must
// NEVER depend on window.location.origin or a request's own host: local
// dev and production point at the exact same Supabase project, so a real
// reset/invite email triggered from anyone's local dev server previously
// produced a real email to a real person with a link back to their own
// localhost -- unreachable for the recipient (confirmed: this is exactly
// what happened to Blimie's invite). Forcing every such link to the real
// production domain regardless of where the code executes closes that
// whole class of bug, not just this one instance of it.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sortandplace.com';

// 2026-07-21: the app now genuinely serves multiple real production
// hostnames (app.sortandplace.com, www.sortandplace.com, the bare apex),
// not just one -- a link always built from the fixed SITE_URL above would
// land an app.sortandplace.com visitor on www instead of back on their own
// subdomain (same bug just fixed in app/login|signup/page.tsx's OAuth
// redirectTo, which -- unlike this -- could switch to the current origin
// unconditionally, since that flow completes synchronously in the same
// browser session). An emailed link can't do that unconditionally: it may
// be opened later, from anywhere, so a request that happens to originate
// from localhost or a Vercel preview URL must still fall back to SITE_URL
// above, not leak that origin into a real person's inbox -- preserves the
// exact guarantee this file was originally created for.
// The app's own hostname -- the ONE host that is the product rather than
// the marketing site. Root layout metadata (SS-577) and the homepage's
// redirect branch both key off this; a string drifting between those two
// call sites would silently split the behaviours.
export const APP_HOSTNAME = 'app.sortandplace.com';

// SS-578, Racquel ruled: the canonical marketing origin is the APEX, no
// www. Every rel=canonical on the marketing pages points here; the www
// host 308s here (next.config.js). Deliberately a literal rather than
// NEXT_PUBLIC_SITE_URL: an env override must not be able to silently move
// the canonical.
export const CANONICAL_ORIGIN = 'https://sortandplace.com';

// The Pinterest profile for the footer Follow button. DELIBERATELY null
// until Racquel supplies the real profile URL -- a guessed handle would
// publish a wrong link on every marketing page, so the button renders
// nothing until this is filled with the verified URL (e.g.
// 'https://www.pinterest.com/<real-handle>/'). Filling it is the entire
// remaining work; the footer wiring is done.
export const PINTEREST_PROFILE_URL: string | null = null;

const KNOWN_PRODUCTION_HOSTS = [APP_HOSTNAME, 'www.sortandplace.com', 'sortandplace.com'];

export function getEmailLinkOrigin(currentOrigin: string | null | undefined): string {
  if (currentOrigin) {
    try {
      if (KNOWN_PRODUCTION_HOSTS.includes(new URL(currentOrigin).hostname.toLowerCase())) {
        return currentOrigin;
      }
    } catch {
      // Malformed origin -- fall through to the safe default below.
    }
  }
  return SITE_URL;
}
