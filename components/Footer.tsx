// components/Footer.tsx
// Minimal by design -- just a Sitemap link and a support contact, nothing
// else. propertyId is optional since a few entry points (login, the
// properties picker) render this before any property context exists.
import Link from 'next/link';

export default function Footer({ propertyId }: { propertyId?: string }) {
  return (
    <footer className="print:hidden py-6 text-center text-xs text-charcoal/40">
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
      <a href="mailto:sortandplace@gmail.com" className="hover:text-charcoal underline underline-offset-2">
        Contact
      </a>
    </footer>
  );
}
