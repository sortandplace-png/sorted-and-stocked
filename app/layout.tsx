// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Nunito_Sans, Playfair_Display, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import OfflineSyncProvider from '@/components/OfflineSyncProvider';
import ServiceWorkerUpdater from '@/components/ServiceWorkerUpdater';
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

export const metadata: Metadata = {
  title: 'Sorted & Stocked',
  manifest: '/manifest.json',
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
  const messages = await getMessages();

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${playfair.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <OfflineSyncProvider>
            <ToastProvider>
              <ServiceWorkerUpdater />
              {children}
            </ToastProvider>
          </OfflineSyncProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
