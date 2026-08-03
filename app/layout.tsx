// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { APP_HOSTNAME, MARKETING_HOSTNAMES } from '@/lib/site-url';
import { Cormorant_Garamond, Nunito_Sans, Playfair_Display, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import OfflineSyncProvider from '@/components/OfflineSyncProvider';
import AppUpdateChecker from '@/components/AppUpdateChecker';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

// Feminine-luxury direction: a romantic high-contrast serif for headers,
// a rounded, warm sans for body/UI — softer terminals than a geometric
// grotesque, which reads warmer at small sizes on data-heavy screens.
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const body = Nunito_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

// Luxury dashboard fonts
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// SS-339: App Router does not expose Pages Router's window.__NEXT_DATA__,
// so there is no built-in client-readable "what build is this" value --
// this is deliberately baked in here as a plain <meta> tag instead. `other`
// is evaluated once, at build time (this whole object is a static module
// constant, not generateMetadata), so it's fixed per-deploy without
// needing a request-time read anywhere. VERCEL_GIT_COMMIT_SHA is set
// automatically by Vercel's build environment; falls back to 'development'
// locally, matching the same fallback in app/api/build-id/route.ts so the
// two always agree and dev never shows a false-positive mismatch.
const APP_BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? 'development';

const BASE_METADATA: Metadata = {
  title: 'Sorted & Stocked',
  manifest: '/manifest.json',
  other: { 'app-build-id': APP_BUILD_ID },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sorted & Stocked',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

// SS-577: Pinterest domain verification, host-conditional. The same
// deployment serves the marketing hostnames AND app.sortandplace.com (see
// the Host-header branch in app/page.tsx), and the ruling is marketing
// only -- the app subdomain must not carry it. Checked via the Host header
// with an ALLOW-list of exactly one hostname that omits the tag, everything
// else (www, apex, localhost, previews) carrying it -- the same shape as
// the homepage's redirect branch, for the same reason. The token is
// designed to be publicly readable; it is not a secret and needs no
// rotation handling. Every page here is already dynamically rendered, so
// reading headers() adds no rendering-mode change.
export async function generateMetadata(): Promise<Metadata> {
  const hostname = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase();
  if (hostname === APP_HOSTNAME) return BASE_METADATA;
  return {
    ...BASE_METADATA,
    verification: { other: { 'p:domain_verify': '7113dd8431f8c47e18cd6a9d8fea41f3' } },
  };
}

// themeColor used to live on `metadata` -- Next.js 15 split it into a
// separate `viewport` export (metadata.themeColor is deprecated and logs a
// build warning). Also fixes a real leftover: '#6B3550' was the pre-rebrand
// plum/aubergine color, retired for cream/charcoal/gold in July -- no
// aubergine should remain anywhere in this app.
// width/initialScale are NOT optional here. Next.js only emits its default
// <meta name="viewport" content="width=device-width, initial-scale=1"> when
// no `viewport` export exists; declaring this object to carry themeColor
// replaced that default, so the app shipped with NO viewport meta tag at
// all. Mobile browsers then fall back to an assumed ~980px desktop width and
// show a 390px window onto it -- which is the real cause of the "horizontal
// overflow": headings clipped to "emap"/"ASHBOARD"/"LAN"/"HOP" and the logo
// cut off. Nothing was actually overflowing; the whole page was being
// rendered too wide. Confirmed by reading the live DOM: meta[name=viewport]
// absent, window.innerWidth 980 at a 390px viewport.
export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // SS-587: on the production marketing hostnames the provider gets an
  // empty bundle. Every public page was shipping the app's entire string
  // table in its payload -- ~60 app strings per page, including internal
  // product copy (bracha guidance, kashrut warnings, cross-house
  // messages) readable in the public source. No marketing page or
  // component calls useTranslations (verified before this change), so
  // nothing renders differently; the payload just stops carrying the
  // table. The app hostname, localhost and previews keep the full bundle
  // -- localhost serves the app in dev, so stripping anything-not-app
  // would have broken dev i18n.
  const hostname = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase();
  const messages = MARKETING_HOSTNAMES.includes(hostname) ? {} : await getMessages();

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${playfair.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <OfflineSyncProvider>
            <ToastProvider>
              <AppUpdateChecker />
              {children}
            </ToastProvider>
          </OfflineSyncProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
