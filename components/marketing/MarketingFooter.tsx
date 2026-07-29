// components/marketing/MarketingFooter.tsx
// Shared footer for the public marketing pages.
//
// Privacy points at /privacy.html, which is the real existing file -- the
// app's own footer already links it that way. /privacy would 404.
import Link from 'next/link';

const LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
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
        <p className="flex items-center gap-2">
          {/* A tel: link, not plain text -- this is a phone number on a page
              most people will read on a phone. */}
          <a href="tel:+17189384342" className="hover:text-denim transition-colors">
            718-938-4342
          </a>
          <span aria-hidden="true">·</span>
          <span>© Sort + Place</span>
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
