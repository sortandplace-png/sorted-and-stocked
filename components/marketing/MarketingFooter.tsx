// components/marketing/MarketingFooter.tsx
// Shared footer for the public marketing pages.
//
// Privacy points at /privacy.html, which is the real existing file -- the
// app's own footer already links it that way. /privacy would 404.
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
}: {
  // The homepage's existing footer already linked Terms before this shared
  // component existed -- an optional extra rather than baking Terms into
  // every page, since only the homepage had it and removing it would be an
  // unrequested regression.
  extraLinks?: { href: string; label: string }[];
}) {
  return (
    <footer className="bg-linen border-t border-cardBorder mt-16">
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
          <span className="whitespace-nowrap">© Sort + Place</span>
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
