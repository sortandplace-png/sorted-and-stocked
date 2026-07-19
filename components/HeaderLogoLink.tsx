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
  propertyId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onDashboard = pathname === `/properties/${propertyId}/dashboard`;

  if (onDashboard) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={`/properties/${propertyId}/dashboard`} className={className}>
      {children}
    </Link>
  );
}
