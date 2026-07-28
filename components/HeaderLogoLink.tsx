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

  if (onDashboard) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
