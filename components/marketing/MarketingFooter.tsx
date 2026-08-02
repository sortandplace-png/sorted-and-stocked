// components/marketing/MarketingFooter.tsx
// Shared footer for the public marketing pages.
//
// Privacy points at /privacy.html, which is the real existing file -- the
// app's own footer already links it that way. /privacy would 404.
//
// BRAND-NAME DEDUPE (Racquel ruling, 2 Aug late): the brand name renders
// ONCE in the footer, plus the email.
// - Every page EXCEPT the homepage: "SortandPlace@gmail.com · (c) Sort +
//   Place" + nav links. No credit line.
// - Homepage ONLY (homepage prop): keeps the Google credit line, and the
//   (c) drops its name so the brand still appears exactly twice there
//   (credit line + email address) -- the minimum possible.
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
  flush = false,
}: {
  // The homepage's existing footer already linked Terms before this shared
  // component existed -- an optional extra rather than baking Terms into
  // every page, since only the homepage had it and removing it would be an
  // unrequested regression.
  extraLinks?: { href: string; label: string }[];
  /** Homepage keeps the Google-verification credit line; see below. */
  homepage?: boolean;
  /** Drop the default mt-16: for short pages (/contact) whose own bottom
      padding already provides the gap -- the two stacked into the dead
      band reported twice on 2 Aug. */
  flush?: boolean;
}) {
  return (
    <footer className={`bg-linen border-t border-cardBorder ${flush ? '' : 'mt-16'}`}>
      <div className="max-w-[1100px] mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-dusk">
        <p className="flex items-center gap-2 flex-wrap justify-center">
          {/* SS-454: NO phone numbers anywhere in the footers (supersedes
              both earlier states -- the single 938 number and the SS-444
              both-numbers build). Rule: one number shown anywhere means
              both must be; default is none. The email link stays. */}
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=sortandplace@gmail.com&su=Sort%20%2B%20Place"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-denim transition-colors"
          >
            SortandPlace@gmail.com
          </a>
          <span aria-hidden="true">·</span>
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
