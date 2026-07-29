// components/HeaderLogoLink.tsx
// SS-021: the header logo should link back to the dashboard when tapped,
// except ON the dashboard itself -- tapping it there would just re-navigate
// to the same page, a real (if harmless) gap in an otherwise-working link.
// Needs usePathname(), so this one small piece is split out as a client
// component rather than making the whole shared property layout client --
// same reasoning CollapsibleCard/Footer split out for their own client-only
// pieces.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  const href = propertyId ? `/properties/${propertyId}/dashboard` : '/properties';
  const onDashboard = pathname === href;

  // SS-022: the visible mark is 36px (LogoMark's w-9 h-9), below the 44px
  // touch target this app uses everywhere else (e.g. MobileBottomNav's
  // min-w-[44px] min-h-[44px]). p-1 + -m-1 pads the hit area to 44px without
  // shifting layout -- the negative margin cancels the padding's effect on
  // surrounding flex siblings (PropertySwitcher).
  const hitArea = 'p-1 -m-1';

  if (onDashboard) {
    return <span className={`${hitArea} ${className ?? ''}`}>{children}</span>;
  }

  return (
    <Link href={href} className={`${hitArea} ${className ?? ''}`}>
      {children}
    </Link>
  );
}
