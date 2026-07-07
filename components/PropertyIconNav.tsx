// components/PropertyIconNav.tsx
// Replaces the dropdown-only PropertyNav with an always-visible row of icon
// links. Every page shows every other section directly — no menu to open —
// without going back to a fixed bottom tab bar (that was deliberately
// removed earlier after direct feedback that it felt cluttered). This sits
// inline right under the header and scrolls horizontally if it overflows,
// so it never claims permanent screen real estate the way a fixed bar does.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropertyRole } from '@/components/PropertyRoleContext';

const ITEMS = [
  { segment: 'inventory', label: 'Inventory', icon: '📦', managerOnly: false },
  { segment: 'meal-plan', label: 'Meal plan', icon: '🍽️', managerOnly: false },
  { segment: 'shopping-list', label: 'Shopping', icon: '🛒', managerOnly: false },
  { segment: 'scan', label: 'Scan', icon: '📷', managerOnly: false },
  { segment: 'shift-handover', label: 'Handover', icon: '📝', managerOnly: false },
  { segment: 'tools', label: 'Tools', icon: '🧰', managerOnly: false },
  { segment: 'print-labels', label: 'Labels', icon: '🏷️', managerOnly: false },
  { segment: 'staff', label: 'Staff', icon: '👥', managerOnly: true },
] as const;

export default function PropertyIconNav({
  propertyId,
  role,
}: {
  propertyId: string;
  role: PropertyRole;
}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.managerOnly || role === 'owner' || role === 'manager');

  return (
    <nav
      className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-aubergine-dark/95 print:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Sections"
    >
      {items.map((item) => {
        const active = pathname.includes(`/${item.segment}`);
        return (
          <Link
            key={item.segment}
            href={`/properties/${propertyId}/${item.segment}`}
            className={
              'flex flex-col items-center justify-center gap-0.5 shrink-0 rounded-2xl px-3.5 py-1.5 min-w-[64px] transition-colors ' +
              (active ? 'bg-gold text-aubergine-dark' : 'text-cream/80 hover:bg-white/10')
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
