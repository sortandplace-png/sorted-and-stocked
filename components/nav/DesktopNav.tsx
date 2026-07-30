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
import { isModuleEnabled, type ModuleKey } from '@/lib/module-flags';

type GroupKey = 'plan' | 'shop' | 'staff' | 'more';

type NavItem = {
  segment: string;
  labelKey: string;
  managerOnly?: boolean;
  // Hides the item entirely when this property has turned the module off
  // (properties.feature_flags, see lib/module-flags.ts) -- independent of
  // managerOnly, which governs role, not the property's own on/off switch.
  module?: ModuleKey;
  // A segment that's a sub-path of another group's own segment (here,
  // 'tools/tasks' is a sub-path of the More group's 'tools') would
  // otherwise highlight both groups active at once on that page — this
  // lists segments to exclude from THIS item's own active check so the
  // more specific group wins.
  excludeFromActive?: string[];
  // Overrides the default /properties/{id}/{segment} link target. Needed
  // for Procurement, which is deliberately cross-property (its own page
  // stitches every property the viewer manages into one view) rather than
  // scoped under the current property like every other item here.
  // `segment` is still set for it, purely so segmentIsActive() has
  // something to match against.
  href?: string;
  // Hairline rule above this item -- separates "what I do" from "what I read"
  // inside the Staff group.
  dividerBefore?: boolean;
};

const GROUPS: { key: GroupKey; labelKey: string; items: NavItem[] }[] = [
  {
    key: 'plan',
    labelKey: 'plan',
    items: [
      { segment: 'recipes', labelKey: 'recipes', module: 'module_recipes' },
      { segment: 'meal-plan', labelKey: 'mealPlan', module: 'module_meal_plan' },
    ],
  },
  {
    key: 'shop',
    labelKey: 'shop',
    items: [
      { segment: 'shopping-list', labelKey: 'shopping', module: 'module_shopping' },
      { segment: 'inventory', labelKey: 'inventory', module: 'module_inventory' },
      // SS-399. Manager-tier like the page's own gate -- staff are
      // redirected out, so this doesn't offer a link they'd bounce off.
      { segment: 'all-houses', labelKey: 'allHouses', managerOnly: true, module: 'module_inventory' },
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
      { segment: 'my-day', labelKey: 'myDay', module: 'module_staff' },
      // Staff Task Center is manager-only now (2026-07-20, Racquel):
      // task_assignments RLS locks task visibility to own-assignments-only
      // per staff member, so a shared team task board no longer makes
      // sense as a staff-facing surface -- staff get their own tasks
      // through My Day instead. Was open to every role before that RLS
      // change made a full board something only a manager can actually see.
      // SS-156 Phase 1: Task Center and Duty Roster are one destination now,
      // two tabs behind this single entry. The staff/duty-roster route still
      // exists and still enforces its own identical owner/manager gate, so a
      // bookmark keeps working -- it just isn't offered as a second door to
      // the same place. Kept in excludeFromActive below so a direct visit to
      // that URL doesn't light up Team.
      { segment: 'tools/tasks', labelKey: 'staffTasks', managerOnly: true, module: 'module_staff' },
      // Hours removed from the dropdown: it belongs inside My Day, not as
      // its own destination. The /staff/hours ROUTE is untouched and still
      // enforces its own owner/manager gate (R21) -- it is simply no longer
      // offered here. Deliberately NOT redirected to My Day yet: My Day has
      // the clock control but no hours summary, so a redirect today would
      // remove the only place the weekly timesheet can be read.
      // Handover nav link removed (SS-214) -- everyone, including owners
      // and managers, now reaches it the same way: embedded on My Day.
      // The standalone /shift-handover route file is untouched (still
      // reachable by direct URL) so nothing breaks for anyone with it
      // bookmarked; this just stops offering it as its own destination.
      // Team management (invite/role-change/remove) stays owner/manager
      // only, same as it's always been.
      // 'staff' is a prefix of 'staff/duty-roster' and the three below, so
      // without this Team would light up active on every one of them.
      {
        segment: 'staff',
        labelKey: 'team',
        managerOnly: true,
        module: 'module_staff',
        excludeFromActive: ['staff/duty-roster', 'staff/hours', 'staff/sops', 'staff/training', 'staff/handbook'],
      },
      // Below the rule is what a housekeeper reads rather than does. The
      // Handbook is now the single destination for all of it: the Guide, the
      // Training Videos tab, and the Procedures tab that holds the SOP
      // Library. Four items total.
      //
      // SOP Library and Training Videos are both gone from this dropdown --
      // not deleted. /staff/sops and /staff/training still exist and still
      // resolve (R21); they are simply no longer their own nav destinations
      // now that the Handbook carries both. The Task Center's "View full
      // procedure" deep link still lands on ?tab=procedures.
      { segment: 'staff/handbook', labelKey: 'staffHandbook', dividerBefore: true, module: 'module_staff' },
    ],
  },
  {
    key: 'more',
    labelKey: 'more',
    items: [
      // print-labels now lives inside Inventory. Staff Task Center and
      // Shift Handover moved to their own Staff group above -- excluded
      // here so this doesn't ALSO light up "More" while on those pages.
      { segment: 'tools', labelKey: 'tools', module: 'module_tools', excludeFromActive: ['tools/tasks'] },
      // Room Photo Review's direct entry point removed from here (folded
      // into Inventory as a bulk action instead -- SS-375/SS-271, same
      // "collapse to one entry point" fix already applied to Handover per
      // SS-114). Procurement is its own top-level page; managerOnly
      // matches the gate it already enforces server-side (staff get
      // redirected out), so this doesn't offer a link staff would just
      // bounce off of.
      { segment: 'procurement', labelKey: 'procurement', managerOnly: true, href: '/procurement' },
      // Not managerOnly -- every role needs this for their own SMS opt-in;
      // the Invite Codes/Broadcast sections inside are what's actually
      // gated, per-role, by the page itself.
      { segment: 'settings', labelKey: 'settings' },
      // Property-agnostic (see app/help/page.tsx) -- href override same as
      // Procurement above, so this doesn't resolve to the default
      // /properties/{id}/help pattern every other item here uses.
      { segment: 'help', labelKey: 'help', href: '/help' },
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
  flags,
}: {
  propertyId: string;
  role: PropertyRole;
  flags: Record<string, unknown>;
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
        const visibleItems = group.items.filter(
          (i) => (!i.managerOnly || role === 'owner' || role === 'manager') && (!i.module || isModuleEnabled(flags, i.module))
        );
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
                    <div key={item.segment}>
                      {item.dividerBefore && <div className="my-1.5 border-t border-cardBorder" role="separator" />}
                    <Link
                      // An href starting with "/" is app-absolute (/procurement,
                      // /help). Anything else is property-scoped, which lets an
                      // override carry a query string -- the segment alone
                      // cannot express ?tab=procedures.
                      href={
                        item.href
                          ? item.href.startsWith('/')
                            ? item.href
                            : `/properties/${propertyId}/${item.href}`
                          : `/properties/${propertyId}/${item.segment}`
                      }
                      role="menuitem"
                      onClick={() => setOpenGroup(null)}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                        active ? 'text-denim font-medium bg-mist' : 'text-dusk hover:bg-mist/50'
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {isModuleEnabled(flags, 'module_inventory') && (
        <button
          onClick={() => setShowScan(true)}
          aria-label={t('scanAriaLabel')}
          className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ScanIcon size={18} strokeWidth={1.5} />
        </button>
      )}

      {showScan && <ScanModal propertyId={propertyId} onClose={() => setShowScan(false)} />}
    </nav>
  );
}
