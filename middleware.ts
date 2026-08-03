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
     * - downloads/ (SS-569, and the THIRD instance of the exact bug already
     *   documented twice above for sw.js and robots.txt: a real file in
     *   public/ that middleware intercepts and 307s to /login, so the file
     *   exists and is unreachable. The extension list below is images only,
     *   so .pdf was never covered. Found because three LIVE blog posts
     *   already link lead-magnet PDFs at /downloads/*.pdf: those URLs
     *   currently return the sign-in page with status 200 -- not a 404, so
     *   nothing monitors it and nothing alerts. Placing the PDF files alone
     *   would NOT have fixed it; they would have kept redirecting.)
     */
    /*
     * ROOT-PATTERN FIX (SS-569, 3 Aug). The exclusion above used to be an
     * ALLOW-LIST OF EXTENSIONS -- six image types plus a handful of named
     * files. Everything in public/ that was not on that list got matched,
     * 307'd to /login and served the sign-in page instead of the file. So
     * every new static file type was broken BY DEFAULT until a person
     * happened to notice, and three separate people did, three times:
     *
     *     sw.js                      the service worker never updated
     *     robots.txt, sitemap.xml    crawlers indexed the sign-in page
     *     downloads/*.pdf            three live posts served a login form,
     *                                with status 200, so nothing alerted
     *
     * Three instances of one bug is the list being the wrong shape, not
     * three oversights. Inverted: exclude any path whose LAST segment
     * contains a dot, i.e. anything that looks like a file. public/ is by
     * definition public, so no file in it should ever be intercepted, and a
     * .csv or .ics or .woff2 added tomorrow now works without an edit here.
     *
     * SAFE because middleware is a UX redirect layer, not the security
     * boundary, and nothing here newly exposes a page: verified that NO
     * route directory under app/ contains a dot, so no page can match this
     * exclusion. Auth is enforced independently anyway -- the property
     * layout redirects on both !user and !membership, the console re-checks
     * user, membership, role and the operator flag itself, api/ is excluded
     * wholesale and self-authenticates (see above), and RLS sits under all
     * of it.
     *
     * The dot test also subsumes favicon.ico, manifest.json, robots.txt,
     * sitemap.xml, sw.js, workbox-*.js, downloads/ and the six image
     * extensions, so they are gone from the pattern rather than lost.
     * _next/image and api/ stay: they have no dot.
     */
    '/((?!_next/static|_next/image|api/|.*\\.[^/]*$).*)',
  ],
};
