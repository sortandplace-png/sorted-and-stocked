// components/Footer.tsx
// Minimal by design -- just a Sitemap link, a support contact, and a small
// attribution line. propertyId is optional since a few entry points
// (login, the properties picker) render this before any property context
// exists. The attribution line matters because the shared domain
// (sortandplace.com) doesn't otherwise visually match the product's own
// name (Sorted & Stocked) anywhere in the app -- real gap, could confuse
// a new user about the connection between the two.
import Link from 'next/link';

export default function Footer({ propertyId }: { propertyId?: string }) {
  return (
    <footer className="print:hidden py-6 text-center text-xs text-charcoal/40 space-y-1">
      <div>
        {propertyId && (
          <>
            <Link
              href={`/properties/${propertyId}/sitemap`}
              className="hover:text-charcoal underline underline-offset-2"
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
          className="hover:text-charcoal underline underline-offset-2"
        >
          Contact
        </a>
      </div>
      <div className="text-[11px] text-charcoal/30">Powered by Sort + Place</div>
    </footer>
  );
}
