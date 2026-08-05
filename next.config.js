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
    // SS-681, and this must stay ABOVE the generic navigation rule below.
    // The Register and the Task Center are SERVER rendered, so the stale
    // answer arrives in the page HTML itself, not only in the client's
    // data reads. NetworkFirst with a 3 second timeout will serve a cached
    // document, and the register's own subtitle promises it is read on
    // every load. A blog post is edited daily and is a public SEO surface,
    // so a stale document there is served to crawlers too.
    //
    // These pages are read at a desk on a real connection, not in a
    // dead-zone pantry, so they lose nothing by refusing the offline
    // fallback.
    {
      urlPattern: ({ request, url }) =>
        request.mode === 'navigate' &&
        (/\/register(\/|$)/.test(url.pathname) ||
          /\/console(\/|$)/.test(url.pathname) ||
          /^\/blog(\/|$)/.test(url.pathname)),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      },
    },
    // SS-681. NEVER CACHE THESE TABLES. This rule must stay ABOVE the
    // generic Supabase rule below, because Workbox takes the FIRST
    // matching route.
    //
    // The generic rule underneath is NetworkFirst with a 3 second timeout
    // and a one hour expiration. On a phone, three seconds is easy to
    // exceed, and when it is exceeded Workbox serves whatever it cached,
    // for up to an hour, with no indication that it did. That is the
    // measured defect: the Task Center read 928 active tasks while the
    // table held 963, and 928 was exactly the count from several hours
    // earlier. The Register showed 629 rows against 637 and listed SS-670
    // and SS-671 as open after both were resolved.
    //
    // These are the tables where a stale answer is worse than no answer,
    // because they are read to decide what to do next:
    //   work_items        the register, whose subtitle promises the table
    //                     is the truth and is read on every load
    //   master_tasks      the Task Center
    //   task_assignments  who owns what
    //   staff_slots       the assignment targets
    //   blog_posts        edited daily
    // Everything else keeps the offline fallback below, so viewing
    // inventory in a dead-zone pantry still works. Correctness beats
    // latency HERE without giving up offline EVERYWHERE.
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(work_items|master_tasks|task_assignments|staff_slots|blog_posts)(\?|$)/i,
      handler: 'NetworkOnly',
      method: 'GET',
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
  // SS-577 root cause: Next 15 streams metadata for dynamic pages, so the
  // whole merged metadata block -- <title>, rel=canonical, the Pinterest
  // p:domain_verify tag -- was emitted in the BODY (measured: </head>
  // closes ~1.5KB in, first metadata ~7-16KB in). Browsers reparent stray
  // metas into the head at parse time, which is why every substring check
  // passed while Pinterest's raw-HTML verifier failed: "is the string
  // present" and "is the element in the head" are different questions.
  // Next's only lever here is this UA regex -- matched agents get BLOCKING
  // metadata rendered inside <head>. Match-everything makes metadata
  // blocking for every client. Verified safe: this config feeds ONLY
  // shouldServeStreamingMetadata (server/base-server.js:1023); bot
  // classification (botType / supportsDynamicResponse) uses the static
  // default regex on a separate path and is unaffected. The cost is
  // metadata resolving before first byte -- a headers() read, microseconds
  // -- against every raw-HTML parser reading an effectively head-less page.
  // VERIFICATION STANDARD for this fix (per SS-577): position of the
  // element must be BEFORE position of </head>, never a substring match.
  htmlLimitedBots: /.*/,
  // /privacy and /terms as clean live URLs -- Google's OAuth consent-screen
  // verification needs both reachable at stable paths, and the only real
  // pages are the static public/*.html files. Rewrites (not redirects) so
  // the clean URL IS the page, no visible .html hop; the .html paths keep
  // working unchanged. Both clean paths are also in the auth middleware's
  // PUBLIC_PATHS so an anonymous crawler is never bounced to /login.
  async rewrites() {
    return [
      { source: '/privacy', destination: '/privacy.html' },
      { source: '/terms', destination: '/terms.html' },
    ];
  },
  // SS-578 REVERTED 3 Aug, minutes after deploy: with this app-level
  // www->apex 308 live, BOTH marketing hosts entered a REDIRECT LOOP
  // (pg_net: "Number of redirects hit maximum amount" on apex and www
  // alike). Cause confirmed from the Vercel Domains panel: the platform
  // config redirects apex->www ("sortandplace.com -- Redirects to
  // www.sortandplace.com"), exactly as app/page.tsx's original comment
  // said. The earlier fetches that seemed to disprove it COULD NOT have
  // shown it -- a redirect-following client lands on www's 200 either
  // way. The platform side must be aligned first
  // (primary domain = apex, www redirecting at the edge), at which point
  // no app-level redirect is needed at all. Do NOT reintroduce this block
  // while the platform config points the other way.
  // Two dev servers on this repo (a human on :3000, an agent on :3100) were
  // both writing to the same .next directory, which on Windows produces
  // EBUSY "resource busy or locked" errors on
  // .next/server/app/page_client-reference-manifest.js and takes both
  // servers down. Giving each its own build dir removes the contention.
  // Defaults to '.next' so nothing changes for a normal single-server run
  // or for `next build`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: [
      'jfaaqzrezcrkkidlsbwj.supabase.co',
    ],
  },
};

module.exports = withNextIntl(withPWA(nextConfig));
