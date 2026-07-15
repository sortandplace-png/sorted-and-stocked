// components/ToolsGroupList.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import ToolModal, { type ToolModalSlug } from '@/components/ToolModal';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';

type Tool = { slug: string; icon: string; title: string; description: string; count?: number };
type Subgroup = { key: string; label: string; lockIcon: boolean; tools: Tool[] };
type Group = { key: string; label: string; tools: Tool[]; subgroups: Subgroup[] };

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
    const cardInner = (
      <>
        <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold/15 text-lg">
          {tool.icon}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-charcoal">{tool.title}</span>
          {typeof tool.count === 'number' && (
            <span className="text-xs font-medium text-charcoal/40 bg-cream px-1.5 py-0.5 rounded-full">
              {tool.count}
            </span>
          )}
        </span>
        <span className="block text-sm text-charcoal/50">{tool.description}</span>
      </>
    );
    const cardClass =
      'flex flex-col items-center text-center gap-2 bg-white rounded-xl2 shadow-sm shadow-charcoal/5 px-4 py-5 hover:shadow-md hover:shadow-charcoal/10 transition-shadow h-full w-full';
    return (
      <li key={tool.slug}>
        {MODAL_SLUGS.has(tool.slug as ToolModalSlug) ? (
          <button onClick={() => setOpenTool(tool.slug as ToolModalSlug)} className={cardClass}>
            {cardInner}
          </button>
        ) : (
          <Link href={`/properties/${propertyId}/tools/${tool.slug}`} className={cardClass}>
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
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center gap-2 mb-2 text-left"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-gold-dark">{group.label}</span>
              <span className="text-xs text-charcoal/40">({totalCount})</span>
              <span className="flex-1 border-t border-gold-light/40" />
              <span className="text-charcoal/40 text-sm">{collapsed ? '▸' : '▾'}</span>
            </button>
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
                      {sg.lockIcon && <Lock size={12} strokeWidth={1.5} className="text-charcoal/40" aria-hidden="true" />}
                      <span className="text-[11px] font-medium uppercase tracking-wider text-charcoal/50">{sg.label}</span>
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
