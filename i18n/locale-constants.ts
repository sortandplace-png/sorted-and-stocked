// i18n/locale-constants.ts
// Plain constants only — no `next/headers` import. i18n/request.ts (server)
// and LocaleToggle.tsx (client) both need LOCALE_COOKIE; if a client
// component imports it from i18n/request.ts directly, webpack pulls that
// file's `next/headers` import into the client bundle and crashes every
// page in the app, not just the ones that render the toggle.
export const LOCALE_COOKIE = 'sns_locale';
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'es'] as const;
