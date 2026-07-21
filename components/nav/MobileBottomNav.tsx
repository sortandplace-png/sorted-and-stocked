// components/nav/MobileBottomNav.tsx
// 5-item fixed bottom bar for small screens — Home, Recipes, Scan (center,
// prominent filled circle), Shopping, Inventory. Tools/Labels/Staff/Handover
// are NOT here — they're reachable from the Dashboard's "More" links block
// instead of being crammed into 9-10 bottom-bar items.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, BookOpen, Scan as ScanIcon, ShoppingCart, Package } from 'lucide-react';
import ScanModal from '@/components/nav/ScanModal';

export default function MobileBottomNav({ propertyId }: { propertyId: string }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [showScan, setShowScan] = useState(false);

  const items = [
    { segment: 'dashboard', labelKey: 'home', Icon: Home },
    { segment: 'recipes', labelKey: 'recipes', Icon: BookOpen },
  ];
  const itemsRight = [
    { segment: 'shopping-list', labelKey: 'shopping', Icon: ShoppingCart },
    { segment: 'inventory', labelKey: 'inventory', Icon: Package },
  ];

  function NavItem({ segment, labelKey, Icon }: { segment: string; labelKey: string; Icon: typeof Home }) {
    const active = pathname.includes(`/${segment}`);
    return (
      <Link
        href={`/properties/${propertyId}/${segment}`}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-lg"
      >
        <Icon size={20} strokeWidth={1.5} className={active ? 'text-brass' : 'text-white/50'} aria-hidden="true" />
        <span className={`text-[10px] font-medium ${active ? 'text-white' : 'text-white/50'}`}>{t(labelKey)}</span>
      </Link>
    );
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-denim border-t border-white/10 flex items-stretch px-2 pb-[env(safe-area-inset-bottom)] print:hidden"
        aria-label="Sections"
      >
        {items.map((i) => (
          <NavItem key={i.segment} {...i} />
        ))}

        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setShowScan(true)}
            aria-label={t('scanAriaLabel')}
            className="-mt-5 w-14 h-14 min-w-[44px] min-h-[44px] rounded-full bg-denim text-white shadow-md shadow-black/20 flex items-center justify-center hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ScanIcon size={24} strokeWidth={1.5} />
          </button>
        </div>

        {itemsRight.map((i) => (
          <NavItem key={i.segment} {...i} />
        ))}
      </nav>

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </>
  );
}
