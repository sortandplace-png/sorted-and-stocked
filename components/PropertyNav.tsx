// components/PropertyNav.tsx
// Replaced the fixed bottom tab bar with a single dropdown menu, per direct
// feedback that a row of icon tabs felt cluttered and unnecessary. Now one
// button in the header opens a list of every section.
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropertyRole } from '@/components/PropertyRoleContext';

const ITEMS = [
  { segment: 'inventory', label: 'Inventory', icon: '📦', managerOnly: false },
  { segment: 'meal-plan', label: 'Meal plan', icon: '🍽️', managerOnly: false },
  { segment: 'shopping-list', label: 'Shopping list', icon: '🛒', managerOnly: false },
  { segment: 'scan', label: 'Scan a label', icon: '📷', managerOnly: false },
  { segment: 'tools', label: 'Tools', icon: '🧰', managerOnly: false },
  { segment: 'print-labels', label: 'Print labels', icon: '🏷️', managerOnly: false },
  { segment: 'bulk-photos', label: 'Bulk add photos', icon: '📸', managerOnly: false },
  { segment: 'staff', label: 'Staff', icon: '👥', managerOnly: true },
] as const;

export default function PropertyNav({
  propertyId,
  role,
}: {
  propertyId: string;
  role: PropertyRole;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  const items = ITEMS.filter((i) => !i.managerOnly || role === 'owner' || role === 'manager');
  const current = items.find((i) => pathname.includes(`/${i.segment}`));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-cream/90 text-sm font-medium"
      >
        <span className="text-lg leading-none">{current?.icon ?? '☰'}</span>
        {current?.label ?? 'Menu'}
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg shadow-aubergine/10 overflow-hidden z-50">
          {items.map((item) => (
            <Link
              key={item.segment}
              href={`/properties/${propertyId}/${item.segment}`}
              onClick={() => setOpen(false)}
              className={
                pathname.includes(`/${item.segment}`)
                  ? 'flex items-center gap-3 px-4 py-3 bg-gold-light/20 text-aubergine font-medium'
                  : 'flex items-center gap-3 px-4 py-3 text-ink hover:bg-gold-light/15 transition-colors'
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
