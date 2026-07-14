// components/nav/DesktopNav.tsx
// Collapses the flat 10-item nav into 5 groups (Dashboard / Plan / Shop /
// Scan / More) to cut decision fatigue — dropdowns open as a small floating
// panel, same ivory background + 0.5px border style used elsewhere in the
// app. Desktop only; see MobileBottomNav.tsx for the small-screen equivalent.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, Scan as ScanIcon } from 'lucide-react';
import type { PropertyRole } from '@/components/PropertyRoleContext';
import ScanModal from '@/components/nav/ScanModal';

type GroupKey = 'plan' | 'shop' | 'more';

const GROUPS: { key: GroupKey; labelKey: string; items: { segment: string; labelKey: string; managerOnly?: boolean }[] }[] = [
  {
    key: 'plan',
    labelKey: 'plan',
    items: [
      { segment: 'recipes', labelKey: 'recipes' },
      { segment: 'meal-plan', labelKey: 'mealPlan' },
    ],
  },
  {
    key: 'shop',
    labelKey: 'shop',
    items: [
      { segment: 'shopping-list', labelKey: 'shopping' },
      { segment: 'inventory', labelKey: 'inventory' },
    ],
  },
  {
    key: 'more',
    labelKey: 'more',
    items: [
      { segment: 'tools', labelKey: 'tools' },
      // print-labels now lives inside Inventory, shift-handover inside
      // Staff's Handover tab — no longer separate top-level entries here.
      { segment: 'staff', labelKey: 'staff', managerOnly: true },
      // Not managerOnly -- every role needs this for their own SMS opt-in;
      // the Invite Codes section inside is what's actually gated, per-role,
      // by the page itself.
      { segment: 'settings', labelKey: 'settings' },
    ],
  },
];

export default function DesktopNav({
  propertyId,
  role,
}: {
  propertyId: string;
  role: PropertyRole;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const [showScan, setShowScan] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenGroup(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const isDashboardActive = pathname.includes('/dashboard');

  return (
    <nav ref={navRef} className="hidden md:flex items-center gap-1 px-3 py-2 bg-cream border-b border-gold-light/40 print:hidden" aria-label="Sections">
      <Link
        href={`/properties/${propertyId}/dashboard`}
        aria-current={isDashboardActive ? 'page' : undefined}
        className={
          'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ' +
          (isDashboardActive
            ? 'bg-white shadow-sm shadow-charcoal/5 text-charcoal border-gold-active'
            : 'text-charcoal/60 hover:bg-white/50 border-transparent')
        }
      >
        {t('dashboard')}
      </Link>

      {GROUPS.map((group) => {
        const visibleItems = group.items.filter((i) => !i.managerOnly || role === 'owner' || role === 'manager');
        if (visibleItems.length === 0) return null;
        const groupActive = visibleItems.some((i) => pathname.includes(`/${i.segment}`));
        const isOpen = openGroup === group.key;

        return (
          <div key={group.key} className="relative">
            <button
              onClick={() => setOpenGroup(isOpen ? null : group.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              aria-current={groupActive ? 'page' : undefined}
              className={
                'flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ' +
                (groupActive
                  ? 'bg-white shadow-sm shadow-charcoal/5 text-charcoal border-gold-active'
                  : 'text-charcoal/60 hover:bg-white/50 border-transparent')
              }
            >
              {t(group.labelKey)}
              <ChevronDown size={14} strokeWidth={1.5} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                role="menu"
                className="absolute top-full left-0 mt-1 min-w-[10rem] bg-cream border border-gold-light/40 rounded-2xl shadow-md py-1.5 z-40"
              >
                {visibleItems.map((item) => {
                  const active = pathname.includes(`/${item.segment}`);
                  return (
                    <Link
                      key={item.segment}
                      href={`/properties/${propertyId}/${item.segment}`}
                      role="menuitem"
                      onClick={() => setOpenGroup(null)}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                        active ? 'text-charcoal font-medium bg-gold-light/20' : 'text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setShowScan(true)}
        aria-label={t('scanAriaLabel')}
        className="rounded-full p-2 text-charcoal/70 hover:bg-white/50 hover:text-charcoal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
      >
        <ScanIcon size={18} strokeWidth={1.5} />
      </button>

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </nav>
  );
}
