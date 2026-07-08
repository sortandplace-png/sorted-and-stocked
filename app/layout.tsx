// app/layout.tsx
import type { Metadata } from 'next';
import { Cormorant_Garamond, Nunito_Sans, Playfair_Display, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import OfflineSyncProvider from '@/components/OfflineSyncProvider';
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
  themeColor: '#6B3550',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sorted & Stocked',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${playfair.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <OfflineSyncProvider>
            <ToastProvider>{children}</ToastProvider>
          </OfflineSyncProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
