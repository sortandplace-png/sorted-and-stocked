// components/marketing/PinterestTag.tsx
// Pinterest tag 2614412627261. MARKETING PAGES ONLY.
//
// WHY THIS IS A PATH-GATED CLIENT COMPONENT AND NOT A MARKETING LAYOUT.
// The instruction was to put this in the marketing layout rather than the
// app layout. THERE IS NO MARKETING LAYOUT: app/layout.tsx is the only
// root, and the marketing routes (/, /blog, /about, /services, /faq,
// /contact, /sitemap) sit at the top level beside /properties, /login and
// the rest, all sharing it. Creating one means moving seven route
// directories into an app/(marketing)/ group, which relocates every
// marketing URL's source and is a large change to make in passing.
//
// Gating on PATHNAME in a client component reaches the same place: the
// script never loads on an authenticated app page. It is also the only
// safe way to do it here. SS-612 records that the root layout must NOT
// vary its output by Host, because a host-varying layout can be served
// across hosts by caches that key on pathname alone; that is why the
// SS-587 marketing-bundle optimisation was reverted. A client component
// decides in the browser, so no cached server render can leak the tag onto
// the app.
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

const PINTEREST_TAG_ID = '2614412627261';

// Deliberately an ALLOWLIST, not a blocklist of app routes. A new
// authenticated route added tomorrow must not start reporting a household's
// browsing to Pinterest because someone forgot to exclude it. A new
// marketing page silently not being tracked is the recoverable mistake;
// the reverse is not.
//
// /login, /signup, /welcome and /entry are deliberately ABSENT. They are
// unauthenticated but they are the app's front door, not the marketing
// site, and the instruction is marketing only.
const MARKETING_PATHS = [
  '/blog',
  '/about',
  '/services',
  '/faq',
  '/contact',
  '/sitemap',
  '/privacy',
  '/terms',
];

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Root is the marketing landing page, matched EXACTLY. Every path starts
  // with "/", so folding it into the startsWith list below would make the
  // whole app marketing, which is the same trap PUBLIC_PATHS documents in
  // lib/supabase/middleware.ts.
  if (pathname === '/') return true;
  return MARKETING_PATHS.some((p) => pathname.startsWith(p));
}

declare global {
  interface Window {
    pintrk?: ((...args: unknown[]) => void) & { queue?: unknown[][]; version?: string };
  }
}

export default function PinterestTag() {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  // The base snippet already fires one 'page' on load. Without this the
  // first render would fire a second one and every landing would count
  // twice.
  const firedInitial = useRef(false);

  useEffect(() => {
    if (!marketing) return;
    if (!firedInitial.current) {
      firedInitial.current = true;
      return;
    }
    // FIRE ON ROUTE CHANGE. This is a single page app: a head script runs
    // 'page' once and never again, so every blog post a reader clicks
    // through to after the first would go untracked. The stub below queues
    // calls made before the script finishes loading, so this is safe even
    // on a fast navigation.
    window.pintrk?.('page');
  }, [pathname, marketing]);

  if (!marketing) return null;

  return (
    <Script id="pinterest-tag" strategy="afterInteractive">
      {`
!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${PINTEREST_TAG_ID}');
pintrk('page');
      `}
    </Script>
  );
}
