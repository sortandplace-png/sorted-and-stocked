// components/marketing/MarketingFooter.tsx
// Shared footer for the public marketing pages.
//
// Privacy points at /privacy.html, which is the real existing file -- the
// app's own footer already links it that way. /privacy would 404.
//
// BRAND-NAME DEDUPE (Racquel ruling, 2 Aug late; REOPENED and completed
// the same evening -- the first pass left the footer still saying the same
// thing three ways: the email, the (c) line, and the Contact nav link).
// The standalone email is now GONE: Contact covers it, and an address sat
// in a footer is scraper bait. Result:
// - Every page EXCEPT the homepage: "(c) Sort + Place" left, nav right.
//   Nothing repeated.
// - Homepage ONLY (homepage prop): keeps the Google credit line, and the
//   (c) drops its name, so the brand name appears exactly ONCE there.
// The email address still lives on /contact and in the Contact nav link.
// These marketing pages render EN-only today (no locale path), so there is
// no ES footer variant to update.
import Link from 'next/link';
import { PINTEREST_PROFILE_URL } from '@/lib/site-url';

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy.html', label: 'Privacy' },
  // SS-432 part 2: the human sitemap page. The XML sibling stays a
  // robots/Search Console concern and is deliberately not footer-linked.
  { href: '/sitemap', label: 'Sitemap' },
];

export default function MarketingFooter({
  extraLinks = [],
  homepage = false,
}: {
  // The homepage's existing footer already linked Terms before this shared
  // component existed -- an optional extra rather than baking Terms into
  // every page, since only the homepage had it and removing it would be an
  // unrequested regression.
  extraLinks?: { href: string; label: string }[];
  /** Homepage keeps the Google-verification credit line; see below. */
  homepage?: boolean;
}) {
  // NO top margin (2 Aug, FOURTH report of the dead-space defect). This
  // component used to carry mt-16, which stacked on top of whatever bottom
  // padding the page already had -- py-20 on most marketing pages -- for
  // 144px of empty background above the footer hairline. The first fix
  // added an opt-in `flush` prop and applied it to /contact only, which
  // fixed the one page reported and left the identical gap on /faq,
  // /services, /about, /blog and the homepage. Removing the margin here
  // fixes all of them at once and deletes the prop: each page's own
  // bottom padding is now the only spacing, which is the thing that was
  // always meant to govern it.
  return (
    // mt-auto is the whole footer-gap fix, and it belongs HERE rather than on
    // each page (SS-501/SS-505, reported four times, "fixed" three times).
    // History: the page wrapper had min-h-screen and the footer had a default
    // mt-16, which stacked into dead space ABOVE the footer. Removing both
    // cleared that but made the wrapper SHORTER than the viewport, so on any
    // screen taller than the content a band of body background sat BELOW the
    // footer instead -- 856px of it on /contact at 1280x1800. Same defect,
    // moved. In a min-h-screen flex-col wrapper, mt-auto absorbs the slack in
    // exactly one place: zero when the page is long, and enough to pin the
    // footer to the bottom when it is short. Neither gap can occur.
    // Every marketing wrapper must therefore carry "min-h-screen flex flex-col".
    <footer className="mt-auto bg-linen border-t border-cardBorder">
      <div className="max-w-[1100px] mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-dusk">
        <p className="flex items-center gap-2 flex-wrap justify-center">
          {/* SS-454: NO phone numbers anywhere in the footers. SS-498: no
              standalone email either -- the Contact nav link on the right
              is the single route to reach us from the footer. */}
          {homepage ? (
            <>
              {/* SS-208 audit: harmless. Copyright year, cosmetic only --
                  a UTC-vs-Eastern off-by-one only matters in the few hours
                  around New Year's, and only ever by reading one year
                  early, never wrong in a way that misrepresents anything. */}
              <span className="whitespace-nowrap">© {new Date().getFullYear()}</span>
              <span aria-hidden="true">·</span>
              {/* Google branding verification ANCHOR -- NEVER REMOVE. The
                  OAuth consent screen registers the app name as "Sorted
                  and Stocked" (the word, not the ampersand -- Racquel
                  confirmed from the screen), and this line must match
                  VERBATIM for the reviewer. Do not "fix" and back to &.
                  The dedupe ruling keeps this line homepage-only. */}
              {/* SS-652: the app keeps its AMPERSAND everywhere in text.
                  "Sorted and Stocked" was the only instance in the repo
                  and the database is clean, so this string was the whole
                  defect. Not the same rule as the practice wordmark,
                  which is "Sort + Place" with the plus (SS-582). */}
              <span>Sorted &amp; Stocked is the household app by Sort + Place</span>
            </>
          ) : (
            <span className="whitespace-nowrap">© Sort + Place</span>
          )}
        </p>

        <nav className="flex items-center gap-x-4 gap-y-1 flex-wrap justify-center">
          {[...LINKS, ...extraLinks].map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-denim transition-colors">
              {l.label}
            </Link>
          ))}
          {/* Pinterest Follow (3 Aug batch): renders only once the real
              profile URL is filled in lib/site-url.ts -- never a guessed
              handle. The domain is claimed and verified (SS-577), so saves
              already attribute; this is the follow path. */}
          {PINTEREST_PROFILE_URL && (
            <a
              href={PINTEREST_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#E60023] hover:opacity-80 transition-opacity font-semibold"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.1 2.47 7.61 6 9.15-.09-.78-.16-1.98.03-2.83.18-.77 1.15-4.88 1.15-4.88s-.29-.59-.29-1.46c0-1.37.79-2.39 1.78-2.39.84 0 1.25.63 1.25 1.39 0 .85-.54 2.11-.82 3.29-.23.98.49 1.78 1.46 1.78 1.75 0 3.1-1.85 3.1-4.52 0-2.36-1.7-4.01-4.12-4.01-2.81 0-4.46 2.11-4.46 4.29 0 .85.33 1.76.74 2.25.08.1.09.19.07.29-.08.31-.25 1-.28 1.14-.04.19-.15.23-.34.14-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.46 0 6.16 2.47 6.16 5.77 0 3.44-2.17 6.21-5.18 6.21-1.01 0-1.96-.53-2.29-1.15l-.62 2.37c-.22.87-.83 1.96-1.24 2.62.93.29 1.92.45 2.95.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
              Follow
            </a>
          )}
        </nav>
      </div>

      {/* SS-621, approved by Racquel with her Rav. Wording is FINAL -- do
          not paraphrase, shorten or "improve" it. These marketing pages
          render EN-only (no locale path), which is why there is no ES
          variant here; the approved Spanish is recorded on SS-621 and
          goes in the moment this tree becomes bilingual. */}
      <div className="border-t border-cardBorder">
        <p className="max-w-[1100px] mx-auto px-4 py-5 text-[12px] leading-relaxed text-dusk">
          Sort + Place builds organizing systems for homes. Our software tracks what a household tells
          it. It does not rule on kashrus, and it is not a halachic authority. Every household&apos;s
          practice is set by that family and their Rav.
        </p>
      </div>
    </footer>
  );
}
