// components/recipes/FilterPill.tsx
// Single filter tile used by every filter row (Course/Dietary/Occasion/Prep)
// on both the desktop and mobile-accordion filter UI in RecipesGridView, and
// by Inventory's category filter -- those were 8+ near-identical inline
// blocks before this extraction, differing only in their data + click
// handler, not their markup or styling.
//
// Tile, not pill (2026-07-19): a rounded-full capsule read as a generic web
// chip, not this app's own visual language -- confirmed live, twice, that a
// recolored/rebordered pill still wasn't the fix. Real shape change instead:
// same rounded-xl2/bg-mist/border-brass/shadow-card tile language as
// /sitemap's nav tiles, just sized down for a filter row (icon on top,
// label + count stacked below) instead of /sitemap's larger 3-line format.
'use client';

import type { LucideIcon } from 'lucide-react';

export function FilterPill({
  active,
  icon,
  label,
  count,
  hebrew,
  onClick,
  title,
}: {
  active: boolean;
  // Most callers (Recipes) pass a real Lucide component. Inventory's
  // category filter uses the app's existing emoji category icons
  // (lib/icon-maps.ts's categoryIcon()) instead -- there's no Lucide
  // equivalent for an open-ended, data-driven category list, and emoji is
  // already the established visual language for categories elsewhere in
  // Inventory (room grid, item cards), so a string is accepted here too
  // rather than forking a second pill component for one prop's type.
  icon: LucideIcon | string;
  label: string;
  count: number;
  hebrew?: string | null;
  onClick: () => void;
  title?: string;
}) {
  const Icon = typeof icon === 'string' ? null : icon;
  const iconEmoji = typeof icon === 'string' ? icon : null;
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-[72px] min-h-[68px] shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl2 border px-1.5 py-2 shadow-card transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim ${
        active ? 'bg-denim border-denim' : 'bg-mist border-brass/30 hover:bg-card'
      }`}
    >
      {Icon ? (
        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-brass'}`} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <span className="text-lg leading-none" aria-hidden="true">
          {iconEmoji}
        </span>
      )}
      <span className={`text-[11px] font-medium leading-tight text-center ${active ? 'text-white' : 'text-denim'}`}>
        {label}
      </span>
      <span className={`text-[9px] leading-tight text-center ${active ? 'text-white/70' : 'text-dusk'}`}>
        ({count})
        {hebrew && (
          <>
            {' '}
            <span lang="he" dir="rtl">
              {hebrew}
            </span>
          </>
        )}
      </span>
    </button>
  );
}

export function FilterPillRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-dusk mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
