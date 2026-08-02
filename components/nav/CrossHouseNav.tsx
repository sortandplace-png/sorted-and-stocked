// components/nav/CrossHouseNav.tsx
// SS-257 (ruled 2 Aug eve): cross-property pages had the app header but
// no navigation at all. This is the slim bar for them -- CROSS-HOUSE
// destinations only, deliberately: property-scoped destinations (a
// dashboard, the console, the register) belong to a chosen house and the
// switcher in the header is the way into one. Same sticky-under-header
// treatment DesktopNav uses on property pages.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/procurement', label: 'Shop All Houses' },
  { href: '/properties', label: 'All Properties' },
];

export default function CrossHouseNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Cross-house sections"
      className="bg-card border-b border-cardBorder px-4 py-2 flex items-center gap-2 print:hidden"
    >
      {LINKS.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`text-[12px] font-semibold uppercase tracking-[0.12em] px-3.5 py-1.5 rounded-full transition-colors ${
              active ? 'bg-denim text-white' : 'text-denim/70 hover:bg-mist'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
