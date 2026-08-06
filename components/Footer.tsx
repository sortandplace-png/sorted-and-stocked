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
import { useTranslations } from 'next-intl';

// SS-454 (Racquel direct, 31 Jul, supersedes the SS-444 both-numbers
// build): NO phone numbers in any footer. The footer is Sitemap ·
// Contact (the Gmail-compose link) · Powered by Sort + Place. Standing
// content rule: if any surface ever shows one business number it must
// show both -- but the default is none.
export default function Footer({ propertyId }: { propertyId?: string }) {
  const pathname = usePathname();
  const t = useTranslations('common');
  // SS-621: approved by Racquel with her Rav, Version C. Wording is FINAL --
  // do not paraphrase, shorten or "improve" it. Rendered on every app
  // screen because the footer is the one component every screen carries.
  // The long-form version is FAQ-112 in help_articles.
  //
  // HARD LINE BREAK, not a wrap. "For any question of halacha, ask your
  // Rav." must sit on its own line at EVERY viewport width, so it cannot
  // be read as a trailing clause of the sentence before it. A wrap moves
  // with the viewport and on a wide screen the whole thing runs as one
  // line; the break has to be in the content.
  //
  // The newline lives inside the SINGLE approved string rather than the
  // string being split into two keys. Two keys is how one half gets edited
  // and the other does not, and this is Rav-approved wording. Verified on
  // change: rejoining the two sentences with a space reproduces the
  // approved text character for character, so only the separator differs.
  // Rendered with whitespace-pre-line, which honours the newline and still
  // collapses ordinary spaces.
  const tHalacha = useTranslations('halachicDisclaimer');
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
            {t('contact')}
          </a>
          <span className="text-brass mx-[13px] text-[13px] font-bold select-none">&bull;</span>
          <span className="text-[12px] text-denim tracking-[0.02em]">Powered by Sort + Place</span>
        </div>
        <p className="mt-3 mx-auto max-w-xl px-4 text-[11px] leading-relaxed text-dusk whitespace-pre-line">{tHalacha('app')}</p>
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
          {t('contact')}
        </a>
      </div>
      <div className="text-[11px] text-dusk">Powered by Sort + Place</div>
      <p className="mx-auto max-w-xl px-4 pt-1 text-[11px] leading-relaxed text-dusk whitespace-pre-line">{tHalacha('app')}</p>
    </footer>
  );
}
