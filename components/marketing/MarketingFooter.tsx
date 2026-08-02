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

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy.html', label: 'Privacy' },
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
    <footer className="bg-linen border-t border-cardBorder">
      <div className="max-w-[1100px] mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-dusk">
        <p className="flex items-center gap-2 flex-wrap justify-center">
          {/* SS-454: NO phone numbers anywhere in the footers. SS-498: no
              standalone email either -- the Contact nav link on the right
              is the single route to reach us from the footer. */}
          {homepage ? (
            <>
              <span className="whitespace-nowrap">© {new Date().getFullYear()}</span>
              <span aria-hidden="true">·</span>
              {/* Google branding verification ANCHOR -- NEVER REMOVE. The
                  OAuth consent screen registers the app name as "Sorted
                  and Stocked" (the word, not the ampersand -- Racquel
                  confirmed from the screen), and this line must match
                  VERBATIM for the reviewer. Do not "fix" and back to &.
                  The dedupe ruling keeps this line homepage-only. */}
              <span>Sorted and Stocked is the household app by Sort + Place</span>
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
        </nav>
      </div>
    </footer>
  );
}
