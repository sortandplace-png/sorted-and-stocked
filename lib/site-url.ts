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
