// components/recipes/FilterPill.tsx
// Single pill button used by every filter row (Course/Dietary/Occasion/Prep)
// on both the desktop and mobile-accordion filter UI in RecipesGridView --
// those were 8 near-identical inline blocks before this extraction (4
// categories x desktop/mobile), differing only in their data + click
// handler, not their markup or styling.
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
    <button onClick={onClick} title={title} className="min-h-11 flex items-center justify-center">
      <span
        className={`flex ${hebrew !== undefined ? 'flex-col items-center gap-0.5' : 'items-center gap-1.5 leading-tight'} text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
          active ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk hover:bg-mist'
        }`}
      >
        <span className="flex items-center gap-1.5 leading-tight">
          {Icon ? (
            <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-brass'}`} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <span className="text-xs leading-none" aria-hidden="true">{iconEmoji}</span>
          )}
          {label}
          {hebrew === undefined && (
            <span className={active ? 'text-white/70' : 'text-dusk'}>({count})</span>
          )}
        </span>
        {hebrew !== undefined && (
          <span className={`flex items-center gap-1 text-[10px] leading-tight ${active ? 'text-white/70' : 'text-dusk'}`}>
            <span>({count})</span>
            {hebrew && (
              <span lang="he" dir="rtl">
                {hebrew}
              </span>
            )}
          </span>
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
      <p className="text-xs font-medium uppercase tracking-wider text-dusk mb-3">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">{children}</div>
    </div>
  );
}
