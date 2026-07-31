// components/HeaderLogoLink.tsx
// SS-021: the header logo links back to the dashboard when tapped. It used
// to suppress that link ON the dashboard itself; SS-414 removed that -- see
// the note above the return for why. No hooks remain, but 'use client' stays
// because this renders inside AppHeader's client subtree and flipping the
// boundary is a separate change from fixing the link.
'use client';

import Link from 'next/link';

export default function HeaderLogoLink({
  propertyId,
  className,
  children,
}: {
  // Optional: cross-property pages have none, and the logo then points at
  // the property picker rather than a dashboard that does not exist.
  propertyId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const href = propertyId ? `/properties/${propertyId}/dashboard` : '/properties';

  // SS-022: the visible mark is 36px (LogoMark's w-9 h-9), below the 44px
  // touch target this app uses everywhere else (e.g. MobileBottomNav's
  // min-w-[44px] min-h-[44px]). p-1 + -m-1 pads the hit area to 44px without
  // shifting layout -- the negative margin cancels the padding's effect on
  // surrounding flex siblings (PropertySwitcher).
  const hitArea = 'p-1 -m-1';

  // SS-414: this used to render a <span> instead of a link when already on
  // the destination -- SS-021 called that "a real (if harmless) gap". It was
  // not harmless. The dashboard is where Racquel spends most of her time, so
  // it is where she taps the home mark most, and there it did nothing at all.
  // Three sessions were spent measuring the link branch while she was tapping
  // the span branch; no cache clear or tap-target change could ever have
  // fixed it. Always a link now: one redundant navigation is a far smaller
  // cost than a control that is dead exactly where it is used most. Same
  // reasoning as SS-412 -- every screen needs a working way out.
  return (
    <Link href={href} className={`${hitArea} ${className ?? ''}`}>
      {children}
    </Link>
  );
}
