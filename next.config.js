// next.config.js
// Requires: npm install next-pwa next-intl
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Static assets: cache-first, instant load even with zero signal.
    // Same-origin only -- an unscoped regex here also matched cross-origin
    // Supabase Storage photo URLs (dashboard-photos/*.jpeg), and CacheFirst
    // never revalidates, so any device that had already hit one of those
    // URLs (even before the real photo existed) kept serving that cached
    // response forever, regardless of how many times the app redeployed.
    {
      urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // App shell / pages: network-first, falling back to cache only when
    // actually offline. StaleWhileRevalidate was here before, but Workbox's
    // Cache Storage keys purely by request URL with no session/cookie
    // awareness — for these per-account server-rendered pages (e.g.
    // /properties), that meant a page cached for one logged-in account
    // could get served to a different account on the same device before
    // the background revalidation caught up. Network-first still supports
    // offline navigation in a dead-zone pantry, it just never prefers a
    // stale cross-account response while online.
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      },
    },
    // Supabase REST reads: network-first with a short timeout, falling back
    // to the last cached response when offline (e.g. viewing inventory in
    // a dead-zone pantry).
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'supabase-reads',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
      },
    },
    // Never cache writes — POST/PATCH/DELETE must go through the
    // background-sync queue implemented in lib/offline-queue.ts instead.
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'jfaaqzrezcrkkidlsbwj.supabase.co',
    ],
  },
};

module.exports = withNextIntl(withPWA(nextConfig));
