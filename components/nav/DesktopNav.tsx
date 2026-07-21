// components/nav/DesktopNav.tsx
// Collapses the flat nav into groups (Dashboard / Plan / Shop / Staff /
// Scan / More) to cut decision fatigue — dropdowns open as a small floating
// panel, same ivory background + 0.5px border style used elsewhere in the
// app. Desktop only; see MobileBottomNav.tsx for the small-screen equivalent.
// Staff Task Center and Shift Handover live here (not buried in the generic
// Tools grid) since staff themselves need direct access to both.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, Scan as ScanIcon } from 'lucide-react';
import type { PropertyRole } from '@/components/PropertyRoleContext';
import ScanModal from '@/components/nav/ScanModal';

type GroupKey = 'plan' | 'shop' | 'staff' | 'more';

type NavItem = {
  segment: string;
  labelKey: string;
  managerOnly?: boolean;
  // A segment that's a sub-path of another group's own segment (here,
  // 'tools/tasks' is a sub-path of the More group's 'tools') would
  // otherwise highlight both groups active at once on that page — this
  // lists segments to exclude from THIS item's own active check so the
  // more specific group wins.
  excludeFromActive?: string[];
};

const GROUPS: { key: GroupKey; labelKey: string; items: NavItem[] }[] = [
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
    key: 'staff',
    labelKey: 'staff',
    items: [
      // My Day first -- audit finding: this is meant to be "the staff
      // member's home" but had zero entry points anywhere in the app
      // (confirmed: no reference in this file or MobileBottomNav.tsx
      // before this).
      { segment: 'my-day', labelKey: 'myDay' },
      // Staff Task Center is manager-only now (2026-07-20, Racquel):
      // task_assignments RLS locks task visibility to own-assignments-only
      // per staff member, so a shared team task board no longer makes
      // sense as a staff-facing surface -- staff get their own tasks
      // through My Day instead. Was open to every role before that RLS
      // change made a full board something only a manager can actually see.
      { segment: 'tools/tasks', labelKey: 'staffTasks', managerOnly: true },
      // Handover nav link removed (SS-214) -- everyone, including owners
      // and managers, now reaches it the same way: embedded on My Day.
      // The standalone /shift-handover route file is untouched (still
      // reachable by direct URL) so nothing breaks for anyone with it
      // bookmarked; this just stops offering it as its own destination.
      // Team management (invite/role-change/remove) stays owner/manager
      // only, same as it's always been.
      { segment: 'staff', labelKey: 'team', managerOnly: true },
    ],
  },
  {
    key: 'more',
    labelKey: 'more',
    items: [
      // print-labels now lives inside Inventory. Staff Task Center and
      // Shift Handover moved to their own Staff group above -- excluded
      // here so this doesn't ALSO light up "More" while on those pages.
      { segment: 'tools', labelKey: 'tools', excludeFromActive: ['tools/tasks'] },
      { segment: 'shopping-rules', labelKey: 'shoppingRules', managerOnly: true },
      // Not managerOnly -- every role needs this for their own SMS opt-in;
      // the Invite Codes/Broadcast sections inside are what's actually
      // gated, per-role, by the page itself.
      { segment: 'settings', labelKey: 'settings' },
    ],
  },
];

function segmentIsActive(pathname: string, item: NavItem): boolean {
  if (!pathname.includes(`/${item.segment}`)) return false;
  return !(item.excludeFromActive ?? []).some((ex) => pathname.includes(`/${ex}`));
}

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
    <nav ref={navRef} className="hidden md:flex items-center gap-1 px-3 py-2 bg-denim border-t border-white/10 print:hidden" aria-label="Sections">
      <Link
        href={`/properties/${propertyId}/dashboard`}
        aria-current={isDashboardActive ? 'page' : undefined}
        className={
          'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' +
          (isDashboardActive
            ? 'bg-mist shadow-sm shadow-black/10 text-denim border-brass'
            : 'text-white/70 hover:bg-white/10 border-transparent')
        }
      >
        {t('dashboard')}
      </Link>

      {GROUPS.map((group) => {
        const visibleItems = group.items.filter((i) => !i.managerOnly || role === 'owner' || role === 'manager');
        if (visibleItems.length === 0) return null;
        const groupActive = visibleItems.some((i) => segmentIsActive(pathname, i));
        const isOpen = openGroup === group.key;

        return (
          <div key={group.key} className="relative">
            <button
              onClick={() => setOpenGroup(isOpen ? null : group.key)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              aria-current={groupActive ? 'page' : undefined}
              className={
                'flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' +
                (groupActive
                  ? 'bg-mist shadow-sm shadow-black/10 text-denim border-brass'
                  : 'text-white/70 hover:bg-white/10 border-transparent')
              }
            >
              {t(group.labelKey)}
              <ChevronDown size={14} strokeWidth={1.5} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                role="menu"
                className="absolute top-full left-0 mt-1 min-w-[10rem] bg-card border border-cardBorder rounded-2xl shadow-md py-1.5 z-40"
              >
                {visibleItems.map((item) => {
                  const active = segmentIsActive(pathname, item);
                  return (
                    <Link
                      key={item.segment}
                      href={`/properties/${propertyId}/${item.segment}`}
                      role="menuitem"
                      onClick={() => setOpenGroup(null)}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                        active ? 'text-denim font-medium bg-mist' : 'text-dusk hover:bg-mist/50'
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
        className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ScanIcon size={18} strokeWidth={1.5} />
      </button>

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </nav>
  );
}
