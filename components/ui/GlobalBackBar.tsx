// components/ui/GlobalBackBar.tsx
// SS-412: the third separate report of users stranded on a page with no way
// back (SS-261 tools pages, SS-383 Add Property, then app-wide). The fix is
// structural -- one BackLink rendered by the shared property layout for
// every child route -- rather than a ninth, tenth, eleventh page adopting
// BackLink one report at a time. The per-page BackLink mounts that existed
// before this (Inventory, Shopping, Suppliers, Print Labels, Yom Tov, All
// Houses, Backup) were removed in the same commit so nothing shows two.
//
// The dashboard is the one exception: it is the home base the fallback
// points AT, and the header logo (SS-414) already leads there from
// everywhere else.
'use client';

import { usePathname } from 'next/navigation';
import BackLink from '@/components/ui/BackLink';

export default function GlobalBackBar({ propertyId }: { propertyId: string }) {
  const pathname = usePathname();
  if (!pathname || pathname.endsWith('/dashboard')) return null;
  return (
    // max-w-5xl matches the container most pages use; on the narrower
    // (max-w-4xl) pages the link sits a little left of the content edge,
    // which reads as chrome, not as a misalignment. print:hidden for the
    // same reason the Footer is.
    <div className="print:hidden max-w-5xl mx-auto px-4 md:px-6 pt-3 -mb-2">
      <BackLink fallbackHref={`/properties/${propertyId}/dashboard`} />
    </div>
  );
}
