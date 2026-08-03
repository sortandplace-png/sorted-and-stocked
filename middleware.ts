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
     * - robots.txt, sitemap.xml (SS-284/SS-143. Same class of bug as sw.js
     *   above: both were being matched and 307'd to /login, so the files
     *   existed and were unreachable -- verified with curl, 307 to /login
     *   on both. A crawler follows that redirect and indexes the sign-in
     *   page as the site's robots policy, which is worse than having no
     *   robots.txt at all. The extension list below is images only, despite
     *   what the line under it used to claim, so .txt and .xml were never
     *   covered by it.)
     * - image extensions
     * - api/ (ALL of it, deliberately, not just diagnostic/batch-* --
     *   SS-347 corrects this comment, which previously named only those
     *   two as intentional. /api/diagnostic was never a real route
     *   (confirmed: no such file exists anywhere under app/api) -- that
     *   part of the old comment was simply wrong. But excluding the whole
     *   prefix is still the right call, not an oversight: every route
     *   under app/api implements its own auth check and returns a JSON
     *   error response (401/403), which is what a fetch() caller is
     *   written to parse. If middleware ran here too, an unauthenticated
     *   call to any authenticated-only API route would get a 307 redirect
     *   to /login instead of that JSON body -- res.json() would throw on
     *   the redirect's HTML, not surface a clean error. The two genuinely
     *   anonymous routes (request-access, consultation-request) plus
     *   batch-* (see their own route files for the session/membership
     *   checks they run internally) all handle "no session" themselves;
     *   none of them need or want middleware's redirect behavior.
     */
    /*
     * - downloads/ (SS-567, and the THIRD instance of the exact bug already
     *   documented twice above for sw.js and robots.txt: a real file in
     *   public/ that middleware intercepts and 307s to /login, so the file
     *   exists and is unreachable. The extension list below is images only,
     *   so .pdf was never covered. Found because three LIVE blog posts
     *   already link lead-magnet PDFs at /downloads/*.pdf: those URLs
     *   currently return the sign-in page with status 200 -- not a 404, so
     *   nothing monitors it and nothing alerts. Placing the PDF files alone
     *   would NOT have fixed it; they would have kept redirecting.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|downloads/|robots\\.txt|sitemap\\.xml|sw\\.js|workbox-.*\\.js|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
