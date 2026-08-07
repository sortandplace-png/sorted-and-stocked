// components/nav/MobileBottomNav.tsx
// Fixed bottom bar for small screens — Recipes, Staff | Scan (center FAB) |
// Shopping, Inventory. The Home tab is GONE (bottom-nav rebalance): the
// header's house mark is the sole route to the dashboard/My Day now. The
// FAB is centered by construction -- the bar is two equal flex-1 halves
// with the FAB a fixed-width cell between them, so it stays mathematically
// centered whatever role/module filtering does to either side's tab count.
//
// Staff opens a sheet rather than a link, because the Staff group is seven
// destinations and the bar has room for one. Before this the bar had no staff
// entry at all and DesktopNav is `hidden md:flex`, so every staff surface was
// desktop-only — a housekeeper on a phone could not reach My Day, the
// handbook, SOPs or training at all. Tools/Labels stay off the bar.
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, Scan as ScanIcon, ShoppingCart, Package, Users, X, type LucideIcon } from 'lucide-react';
import ScanModal from '@/components/nav/ScanModal';
import type { PropertyRole } from '@/components/PropertyRoleContext';
import { isModuleEnabled, isOperatorConsole } from '@/lib/module-flags';

// Mirrors DesktopNav's staff group. managerOnly matches each page's own
// server-side gate, so staff are never offered a link that redirects them
// out. Every entry here is module_staff by default -- the whole sheet is
// gated as one unit below -- except the two SS-856 entries at the end,
// which are module_tools on DesktopNav and need the same independent
// check here (a property could have Tools off and Staff on, or vice
// versa).
const STAFF_LINKS: {
  segment: string;
  labelKey: string;
  managerOnly?: boolean;
  // Stricter than managerOnly: the register is the operator's own working
  // record and its route redirects managers too -- offering it wider would
  // be a dead click (the exact Suppliers-tile bug SS-025 fixed).
  ownerOnly?: boolean;
  dividerBefore?: boolean;
  href?: string;
  operatorOnly?: boolean;
  hideOnOperator?: boolean;
  requiresModuleTools?: boolean;
}[] = [
  { segment: 'my-day', labelKey: 'myDay' },
  // SS-436 retirement, mirroring DesktopNav: on the operator property the
  // console absorbed the Task Center and the Team page, so their entries
  // hide there (routes untouched, R21) and the console entry appears.
  // Client houses keep Team; Task Center was operator-only already.
  { segment: 'console', labelKey: 'console', managerOnly: true, operatorOnly: true },
  // Racquel's expected sheet order on Lax: My Day, Operator Console,
  // Register, Staff Handbook. Owner-only -- staff must not see it exists.
  // SS-616 (Racquel, 4 Aug: "make the register open for sortandplace
  // manager on lax"): manager+ rather than owner-only, and scoped by
  // operatorOnly to the operator-console property -- NOT to the manager
  // role globally. That distinction is load-bearing: managers hold seats
  // on Main, Country, Low and Henderson, and demo@sortedandstocked.com
  // (the Apple App Review login) is a manager on QA Demo. Lax is the only
  // property carrying operator_console, verified against feature_flags,
  // so this opens the register to Lax managers and nobody else. Not done
  // by promoting the account to owner: SS-609 settled that
  // sortandplace@gmail.com is manager everywhere and owner of nothing.
  { segment: 'register', labelKey: 'register', managerOnly: true, operatorOnly: true },
  // Hours and Training Videos removed here too -- these two lists mirror
  // each other, and a dropdown that differs between desktop and phone is
  // worse than either version alone. Both ROUTES are untouched (R21); see
  // DesktopNav for why neither is redirected yet.
  { segment: 'staff', labelKey: 'team', managerOnly: true, hideOnOperator: true },
  // SOP Library removed here too, same reason as DesktopNav: the Handbook's
  // Procedures tab is where it lives now, so a second nav item pointing into
  // the same page was two doors to one room. Route untouched (R21).
  { segment: 'staff/handbook', labelKey: 'staffHandbook', dividerBefore: true },
  // SS-856: House Manual and Photo Review, mirroring DesktopNav's promotion
  // out of the dissolved More dropdown -- mobile had NO path to either
  // before (Tools/Labels stay off the bar, per this file's own header
  // comment), so this is a real access fix here, not just parity.
  { segment: 'tools/knowledge-base', labelKey: 'houseManual', requiresModuleTools: true },
  { segment: 'tools/photo-worklist', labelKey: 'photoReview', managerOnly: true, requiresModuleTools: true },
];

export default function MobileBottomNav({
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
  const [showScan, setShowScan] = useState(false);
  const [showStaff, setShowStaff] = useState(false);

  // Rendered through a portal to document.body (below). position:fixed
  // positions against the nearest ancestor with a transform/filter/
  // backdrop-filter -- a "containing block" -- instead of the viewport,
  // which is exactly how a fixed bar ends up floating mid-page and
  // scrolling with content (the Browse-by-Room regression). Portaling to
  // body means NO app wrapper -- present or future, page-level or
  // layout-level -- can ever capture this bar; it is pinned to the real
  // viewport everywhere the layout renders it, for every role. The
  // mounted gate exists because document doesn't exist during SSR; the
  // bar appears at hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const staffModuleOn = isModuleEnabled(flags, 'module_staff');
  const operator = isOperatorConsole(flags);
  const staffLinks = STAFF_LINKS.filter(
    (l) =>
      (!l.ownerOnly || role === 'owner') &&
      (!l.managerOnly || role === 'owner' || role === 'manager') &&
      (!l.operatorOnly || operator) &&
      (!l.hideOnOperator || !operator) &&
      (!l.requiresModuleTools || isModuleEnabled(flags, 'module_tools'))
  );

  // No Home tab -- the header's house mark is the sole route home now.
  const items = [
    ...(isModuleEnabled(flags, 'module_recipes') ? [{ segment: 'recipes', labelKey: 'recipes', Icon: BookOpen }] : []),
  ];
  const itemsRight = [
    ...(isModuleEnabled(flags, 'module_shopping') ? [{ segment: 'shopping-list', labelKey: 'shopping', Icon: ShoppingCart }] : []),
    ...(isModuleEnabled(flags, 'module_inventory') ? [{ segment: 'inventory', labelKey: 'inventory', Icon: Package }] : []),
  ];

  if (!mounted) return null;

  function NavItem({ segment, labelKey, Icon }: { segment: string; labelKey: string; Icon: LucideIcon }) {
    const active = pathname.includes(`/${segment}`);
    return (
      <Link
        href={`/properties/${propertyId}/${segment}`}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-lg"
      >
        <Icon size={20} strokeWidth={1.5} className={active ? 'text-brass' : 'text-white/50'} aria-hidden="true" />
        <span
          className={`text-[10px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full [-webkit-text-size-adjust:100%] [text-size-adjust:100%] ${active ? 'text-white' : 'text-white/50'}`}
        >
          {t(labelKey)}
        </span>
      </Link>
    );
  }

  return createPortal(
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-denim border-t border-white/10 flex items-stretch px-2 pb-[env(safe-area-inset-bottom)] print:hidden"
        aria-label="Sections"
      >
        {/* Two equal flex-1 halves around a fixed-width FAB cell: the FAB
            is centered by flex spacing, never a hardcoded offset, and stays
            centered even when module/role filtering leaves the halves with
            different tab counts (the staff variant included). */}
        <div className="flex-1 flex items-stretch min-w-0">
          {items.map((i) => (
            <NavItem key={i.segment} {...i} />
          ))}

          {staffModuleOn && (
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
                className={`text-[10px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full [-webkit-text-size-adjust:100%] [text-size-adjust:100%] ${
                  pathname.includes('/staff') || pathname.includes('/my-day') ? 'text-white' : 'text-white/50'
                }`}
              >
                {t('staff')}
              </span>
            </button>
          )}
        </div>

        <div className="w-16 shrink-0 flex items-center justify-center">
          {isModuleEnabled(flags, 'module_inventory') && (
            <button
              onClick={() => setShowScan(true)}
              aria-label={t('scanAriaLabel')}
              className="-mt-5 w-14 h-14 min-w-[44px] min-h-[44px] rounded-full bg-denim text-white shadow-md shadow-black/20 flex items-center justify-center hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ScanIcon size={24} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="flex-1 flex items-stretch min-w-0">
          {itemsRight.map((i) => (
            <NavItem key={i.segment} {...i} />
          ))}
        </div>
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
                    // Same href override as DesktopNav -- these two lists
                    // mirror each other, and SOP Library needs a query
                    // string its segment cannot express.
                    href={`/properties/${propertyId}/${l.href ?? l.segment}`}
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
    </>,
    document.body
  );
}
