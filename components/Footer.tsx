// components/Footer.tsx
// Minimal by design -- just a Sitemap link, a support contact, and a small
// attribution line. propertyId is optional since a few entry points
// (login, the properties picker) render this before any property context
// exists. The attribution line matters because the shared domain
// (sortandplace.com) doesn't otherwise visually match the product's own
// name (Sorted & Stocked) anywhere in the app -- real gap, could confuse
// a new user about the connection between the two.
//
// Concept B (denim/brass) styling is scoped route-by-route as each page
// migrates, not applied globally -- most pages this Footer renders on
// (login, signup, etc.) still haven't moved off the charcoal/gold
// palette. usePathname (not a prop threaded through the shared property
// layout, which renders this same Footer for every child route) is what
// makes per-route scoping possible without touching the layout or
// duplicating a second footer on top of this one. The properties picker
// (exact path /properties, no property id yet) joined the Dashboard route
// here once it migrated too.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer({ propertyId }: { propertyId?: string }) {
  const pathname = usePathname();
  const conceptB = (pathname?.endsWith('/dashboard') || pathname === '/properties') ?? false;

  // Concept B (Dashboard only): one unified line, uniform 12px Inter/denim
  // for every item including the attribution text, brass bullet separators
  // throughout -- matches the Figma Make source exactly (Footer.tsx), not
  // the two-line label+muted-attribution split used everywhere else.
  if (conceptB) {
    return (
      <footer className="print:hidden text-center border-t border-cardBorder mt-12 pt-[22px] pb-11">
        <div className="flex items-center justify-center flex-wrap">
          {propertyId && (
            <>
              <Link
                href={`/properties/${propertyId}/sitemap`}
                className="text-[12px] text-denim tracking-[0.02em] hover:underline underline-offset-2"
              >
                Sitemap
              </Link>
              <span className="text-brass mx-[13px] text-[13px] font-bold select-none">&bull;</span>
            </>
          )}
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=sortandplace@gmail.com&su=Sorted%20%26%20Stocked%20Support"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-denim tracking-[0.02em] hover:underline underline-offset-2"
          >
            Contact
          </a>
          <span className="text-brass mx-[13px] text-[13px] font-bold select-none">&bull;</span>
          <span className="text-[12px] text-denim tracking-[0.02em]">Powered by Sort + Place</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="print:hidden py-6 text-center text-xs text-dusk space-y-1">
      <div>
        {propertyId && (
          <>
            <Link
              href={`/properties/${propertyId}/sitemap`}
              className="hover:text-denim underline underline-offset-2"
            >
              Sitemap
            </Link>
            <span className="mx-2">·</span>
          </>
        )}
        {/* mailto: silently does nothing on a device with no registered
            mail handler (confirmed: fails even with Gmail open in another
            tab -- that's not the same as being the registered handler).
            Every real account in this app is a Gmail address, so a Gmail
            compose URL works everywhere a browser does, regardless of
            device mail-client setup. Still just "Contact" as the visible
            text, not the raw address. */}
        <a
          href="https://mail.google.com/mail/?view=cm&fs=1&to=sortandplace@gmail.com&su=Sorted%20%26%20Stocked%20Support"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-denim underline underline-offset-2"
        >
          Contact
        </a>
      </div>
      <div className="text-[11px] text-dusk">Powered by Sort + Place</div>
    </footer>
  );
}
