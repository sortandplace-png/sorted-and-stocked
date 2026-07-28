// components/nav/MobileBottomNav.tsx
// Fixed bottom bar for small screens — Home, Recipes, Staff, Scan (center,
// prominent filled circle), Shopping, Inventory.
//
// Staff opens a sheet rather than a link, because the Staff group is seven
// destinations and the bar has room for one. Before this the bar had no staff
// entry at all and DesktopNav is `hidden md:flex`, so every staff surface was
// desktop-only — a housekeeper on a phone could not reach My Day, the
// handbook, SOPs or training at all. Tools/Labels stay off the bar.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, BookOpen, Scan as ScanIcon, ShoppingCart, Package, Users, X } from 'lucide-react';
import ScanModal from '@/components/nav/ScanModal';
import type { PropertyRole } from '@/components/PropertyRoleContext';

// Mirrors DesktopNav's staff group. managerOnly matches each page's own
// server-side gate, so staff are never offered a link that redirects them out.
const STAFF_LINKS: { segment: string; labelKey: string; managerOnly?: boolean; dividerBefore?: boolean }[] = [
  { segment: 'my-day', labelKey: 'myDay' },
  { segment: 'tools/tasks', labelKey: 'staffTasks', managerOnly: true },
  { segment: 'staff/duty-roster', labelKey: 'dutyRoster', managerOnly: true },
  // SS-285, kept in step with DesktopNav's staff group -- these two lists
  // mirror each other, and a link that exists on desktop only is a link
  // staff on phones will never find.
  { segment: 'staff/hours', labelKey: 'hours', managerOnly: true },
  { segment: 'staff', labelKey: 'team', managerOnly: true },
  { segment: 'staff/sops', labelKey: 'sopLibrary', dividerBefore: true },
  { segment: 'staff/training', labelKey: 'trainingVideos' },
  { segment: 'staff/handbook', labelKey: 'staffHandbook' },
];

export default function MobileBottomNav({
  propertyId,
  role,
}: {
  propertyId: string;
  role: PropertyRole;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [showScan, setShowScan] = useState(false);
  const [showStaff, setShowStaff] = useState(false);

  const staffLinks = STAFF_LINKS.filter((l) => !l.managerOnly || role === 'owner' || role === 'manager');

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

        <button
          onClick={() => setShowStaff(true)}
          aria-haspopup="dialog"
          aria-expanded={showStaff}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] py-1.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Users
            size={20}
            strokeWidth={1.5}
            className={pathname.includes('/staff') || pathname.includes('/my-day') ? 'text-brass' : 'text-white/50'}
            aria-hidden="true"
          />
          <span
            className={`text-[10px] font-medium ${
              pathname.includes('/staff') || pathname.includes('/my-day') ? 'text-white' : 'text-white/50'
            }`}
          >
            {t('staff')}
          </span>
        </button>

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

      {/* Sheet, not a page: the seven staff destinations are reachable in two
          taps and dismissing returns you where you were -- no browser back. */}
      {showStaff && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 flex items-end print:hidden"
          onClick={() => setShowStaff(false)}
        >
          <div
            role="dialog"
            aria-label={t('staff')}
            className="w-full bg-card rounded-t-xl3 border-t border-cardBorder pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-cardBorder">
              <span className="font-display text-[18px] text-denim">{t('staff')}</span>
              <button
                onClick={() => setShowStaff(false)}
                aria-label={t('close')}
                className="w-11 h-11 -mr-3 flex items-center justify-center text-dusk"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <ul className="py-1.5">
              {staffLinks.map((l) => (
                <li key={l.segment}>
                  {l.dividerBefore && <div className="my-1.5 border-t border-cardBorder" role="separator" />}
                  <Link
                    href={`/properties/${propertyId}/${l.segment}`}
                    onClick={() => setShowStaff(false)}
                    className="block px-5 py-3 text-[15px] text-denim min-h-[44px]"
                  >
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </>
  );
}
