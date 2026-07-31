// components/marketing/MarketingHeader.tsx
// Shared nav for the public marketing pages. Server component -- it holds
// no state, and keeping it out of the client bundle means the crawler and
// a cold first paint both get the nav as markup.
//
// "Get the App" points at /properties per spec. Functionally identical to
// /login for a signed-out visitor either way -- /properties sits behind the
// middleware and bounces to /login regardless -- but a signed-in visitor
// (an existing client who bookmarked the marketing site) lands one hop
// sooner this way.
import Link from 'next/link';

const NAV = [
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingHeader() {
  return (
    <header className="bg-linen border-b border-cardBorder">
      <div className="max-w-[1100px] mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-[22px] text-denim shrink-0">
          Sort + Place
        </Link>

        {/* The links collapse to a wrapped row on narrow screens rather than
            a hamburger: four items fit, and a menu button would be a whole
            interactive component for a list that does not need hiding. */}
        <nav className="flex items-center gap-x-5 gap-y-1 flex-wrap justify-end">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] text-dusk hover:text-denim transition-colors"
            >
              {item.label}
            </Link>
          ))}
          {/* Denim fill, not brass -- brass is an accent, never a fill (D-01). */}
          <Link
            href="/properties"
            className="shrink-0 bg-denim text-white text-[12px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            Get the App
          </Link>
        </nav>
      </div>
    </header>
  );
}
