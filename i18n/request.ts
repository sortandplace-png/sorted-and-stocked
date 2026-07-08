// i18n/request.ts
// next-intl v3 request config. Locale is read from a cookie (not the URL),
// since the app needs a simple EN|ES toggle rather than locale-prefixed
// routes. Default EN.
//
// Server-only (imports next/headers) — the actual LOCALE_COOKIE/DEFAULT_LOCALE
// constants live in i18n/locale-constants.ts so client components (like
// LocaleToggle) can use them without pulling this file's next/headers
// import into the client bundle.

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locale-constants';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = SUPPORTED_LOCALES.includes(cookieLocale as any)
    ? (cookieLocale as string)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
