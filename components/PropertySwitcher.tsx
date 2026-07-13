// components/PropertySwitcher.tsx
// Replaces the static property-name subtitle in the header with a real
// switcher. Preserves whatever section the user is currently on (e.g.
// /shopping-list) when switching, rather than always bouncing to dashboard.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';

export type SwitcherProperty = { id: string; name: string };

export default function PropertySwitcher({
  currentPropertyId,
  currentPropertyName,
  properties,
}: {
  currentPropertyId: string;
  currentPropertyName: string;
  properties: SwitcherProperty[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  // Nothing to switch to — render the plain label as before rather than a
  // dropdown with a single dead-end option.
  if (properties.length <= 1) {
    return <span className="block text-[11px] text-charcoal/60 truncate">{currentPropertyName}</span>;
  }

  function switchTo(propertyId: string) {
    setOpen(false);
    if (propertyId === currentPropertyId) return;
    const rest = pathname.split(`/properties/${currentPropertyId}`)[1] ?? '/dashboard';
    router.push(`/properties/${propertyId}${rest}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 text-[11px] font-medium text-charcoal/70 hover:text-charcoal transition-colors -ml-0.5 pl-0.5 pr-1.5 py-0.5 rounded-full hover:bg-gold-light/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
      >
        <span className="truncate max-w-[9rem]">{currentPropertyName}</span>
        <ChevronDown size={12} strokeWidth={2} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 min-w-[12rem] bg-cream border border-gold-light/40 rounded-2xl shadow-md shadow-charcoal/10 py-1.5 z-50"
        >
          {properties.map((p) => {
            const active = p.id === currentPropertyId;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => switchTo(p.id)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-left whitespace-nowrap transition-colors ${
                  active ? 'text-charcoal font-medium bg-gold-light/20' : 'text-charcoal/70 hover:bg-gold-light/10'
                }`}
              >
                <span className="font-display truncate">{p.name}</span>
                {active && <Check size={14} strokeWidth={2} className="text-gold-dark shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
