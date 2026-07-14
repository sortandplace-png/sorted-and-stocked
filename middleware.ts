// middleware.ts  (project root, next to package.json)
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico, manifest.json, icons/ (PWA assets)
     * - sw.js, workbox-*.js (PWA service worker + its chunks -- these were
     *   NOT excluded before, so an unauthenticated fetch of /sw.js (e.g.
     *   the browser's own periodic update-check, which runs regardless of
     *   session state) got redirected to /login and served that page's HTML
     *   instead of the real script. Browsers silently keep the old cached
     *   service worker when an update fetch doesn't return valid JS, so
     *   this could block a new service worker from ever being picked up,
     *   not just break the initial registration.)
     * - anything with a file extension (images, etc.)
     * - /api/diagnostic, /api/batch-* (public batch operations)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw\\.js|workbox-.*\\.js|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
