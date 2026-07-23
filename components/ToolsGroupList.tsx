// components/ToolsGroupList.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  Tag,
  Microscope,
  UtensilsCrossed,
  Timer,
  Users,
  RotateCcw,
  Hourglass,
  MapPin,
  ArrowLeftRight,
  Copy,
  Link2,
  Calendar,
  SquareCheck,
  Store,
  History,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import ToolModal, { type ToolModalSlug } from '@/components/ToolModal';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import Pin from '@/components/PinAccent';

type Tool = { slug: string; icon: string; title: string; description: string; count?: number };
type Subgroup = { key: string; label: string; lockIcon: boolean; tools: Tool[] };
type Group = { key: string; label: string; tools: Tool[]; subgroups: Subgroup[] };

// Scanners + Kitchen's top-level tools + Prep & Reset (SS-249's original
// batch), Reference's pantry-zones/borrowed-items + Admin Cleanup's
// duplicate-ingredients/needs-linking (SS-279 -- same slugs/icons as
// InventoryClient.tsx's own Inventory Ops footer, kept in sync on
// purpose), and Kitchen's Calendar subgroup + House's loose tools
// (SS-280). The rest of the page is still emoji, not yet in scope. Keyed
// by slug rather than changing TOOLS' own `icon` field in page.tsx, so a
// slug that's ever renamed/removed here harmlessly falls back to its
// emoji instead of rendering nothing.
//
// SS-280 icon choices, and the two departures from what was suggested:
// halachic-calendar and yom-tov-year-view deliberately share Calendar
// (asked for explicitly, and they're adjacent tiles in the same
// subgroup, so sharing reads as "both calendar tools" rather than as a
// mistake). takeout-directory uses Store instead of the suggested
// UtensilsCrossed, and taste-memory uses Heart instead of the suggested
// Users -- both suggested icons were already claimed above (recipe-
// stealer, guest-scaler) for genuinely unrelated tools, so reusing them
// here would read as a mistake, not a deliberate pairing.
const TOOL_ICON_OVERRIDES: Record<string, LucideIcon> = {
  'price-scanner': Tag,
  'ingredient-scanner': Microscope,
  'recipe-stealer': UtensilsCrossed,
  'kitchen-timer': Timer,
  'guest-scaler': Users,
  'reset-checklist': RotateCcw,
  'prep-timeline': Hourglass,
  'pantry-zones': MapPin,
  'borrowed-items': ArrowLeftRight,
  'duplicate-ingredients': Copy,
  'needs-linking': Link2,
  'halachic-calendar': Calendar,
  'yom-tov-year-view': Calendar,
  tasks: SquareCheck,
  'takeout-directory': Store,
  'memory-timeline': History,
  'taste-memory': Heart,
};

// Same modal treatment already proven for Kitchen Ops (opened from a
// recipe, via KitchenOpsToolModal) applied here to the tools that are
// simple enough to fit -- getting "stuck" on a full-page tool with no way
// back except browser Back was the actual complaint. Needs Linking,
// Taste Memory, Staff Task Center, and Home Memory Timeline stay full
// pages on purpose (real content-heavy exceptions, not overlooked).
const MODAL_SLUGS = new Set<ToolModalSlug>([
  'price-scanner',
  'ingredient-scanner',
  'recipe-stealer',
  'pantry-zones',
  'borrowed-items',
  'duplicate-ingredients',
  'photo-review',
  'knowledge-base',
  'contacts',
  'takeout-directory',
  'halachic-calendar',
  'capture-photo',
  'identify-item',
  'link-captured-photos',
  'hechsher-verification',
  'kosher-type-tagging',
]);

export default function ToolsGroupList({ propertyId, groups }: { propertyId: string; groups: Group[] }) {
  const role = usePropertyRole();
  // Same pattern as RecipesGridView's collapsedLetters: empty set means
  // everything starts expanded, and there's no persistence layer, so
  // collapse state resets on every page load -- matches that page's
  // behavior rather than inventing a new persistence convention here.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [openTool, setOpenTool] = useState<ToolModalSlug | null>(null);

  function toggleGroup(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toolCard(tool: Tool) {
    const OverrideIcon = TOOL_ICON_OVERRIDES[tool.slug];
    const cardInner = (
      <>
        {OverrideIcon ? (
          <span className="w-11 h-11 flex items-center justify-center">
            <OverrideIcon size={28} className="text-denim" aria-hidden="true" />
          </span>
        ) : (
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold/15 text-lg">
            {tool.icon}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-denim">{tool.title}</span>
          {typeof tool.count === 'number' && (
            <span className="text-xs font-medium text-brass bg-brass/15 px-1.5 py-0.5 rounded-full">
              {tool.count}
            </span>
          )}
        </span>
        <span className="block text-sm text-dusk">{tool.description}</span>
      </>
    );
    const cardClass =
      'flex flex-col items-center text-center gap-2 bg-mist border border-brass/30 rounded-xl2 shadow-card px-4 py-5 hover:shadow-cardHover transition-shadow h-full w-full';
    return (
      <li key={tool.slug}>
        {MODAL_SLUGS.has(tool.slug as ToolModalSlug) ? (
          <button onClick={() => setOpenTool(tool.slug as ToolModalSlug)} className={cardClass}>
            {cardInner}
          </button>
        ) : (
          <Link
            href={
              tool.slug === 'blog'
                ? `/properties/${propertyId}/blog`
                : `/properties/${propertyId}/tools/${tool.slug}`
            }
            className={cardClass}
          >
            {cardInner}
          </Link>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const collapsed = collapsedKeys.has(group.key);
        // Admin Cleanup (and any other lockIcon subgroup) is owner/manager
        // only -- staff shouldn't see it exists, not just be blocked inside it.
        const visibleSubgroups = group.subgroups.filter((sg) => !sg.lockIcon || canManage(role));
        const totalCount =
          group.tools.length + visibleSubgroups.reduce((sum, sg) => sum + sg.tools.length, 0);
        return (
          <div key={group.key}>
            <div className="relative w-full flex items-center gap-2 mb-2 pr-6">
              <Pin size="sm" collapsed={collapsed} onToggle={() => toggleGroup(group.key)} />
              <span className="text-xs font-medium uppercase tracking-wider text-brass">{group.label}</span>
              <span className="text-xs text-dusk">({totalCount})</span>
              <span className="flex-1 border-t border-cardBorder" />
            </div>
            {!collapsed && (
              <div className="space-y-4">
                {group.tools.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.tools.map((tool) => toolCard(tool))}
                  </ul>
                )}
                {visibleSubgroups.map((sg) => (
                  <div key={sg.key}>
                    <div className="flex items-center gap-1.5 mb-2 pl-1">
                      {sg.lockIcon && <Lock size={12} strokeWidth={1.5} className="text-dusk" aria-hidden="true" />}
                      <span className="text-[11px] font-medium uppercase tracking-wider text-dusk">{sg.label}</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sg.tools.map((tool) => toolCard(tool))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {openTool && (
        <ToolModal slug={openTool} propertyId={propertyId} onClose={() => setOpenTool(null)} />
      )}
    </div>
  );
}
