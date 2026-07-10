// components/ToolsGroupList.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tool = { slug: string; icon: string; title: string; description: string };
type Group = { key: string; label: string; tools: Tool[] };

export default function ToolsGroupList({ propertyId, groups }: { propertyId: string; groups: Group[] }) {
  // Same pattern as RecipesGridView's collapsedLetters: empty set means
  // everything starts expanded, and there's no persistence layer, so
  // collapse state resets on every page load -- matches that page's
  // behavior rather than inventing a new persistence convention here.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const collapsed = collapsedKeys.has(group.key);
        return (
          <div key={group.key}>
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center gap-2 mb-2 text-left"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-gold-dark">{group.label}</span>
              <span className="text-xs text-charcoal/40">({group.tools.length})</span>
              <span className="flex-1 border-t border-gold-light/40" />
              <span className="text-charcoal/40 text-sm">{collapsed ? '▸' : '▾'}</span>
            </button>
            {!collapsed && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.tools.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/properties/${propertyId}/tools/${tool.slug}`}
                      className="flex flex-col items-center text-center gap-2 bg-white rounded-xl2 shadow-sm shadow-charcoal/5 px-4 py-5 hover:shadow-md hover:shadow-charcoal/10 transition-shadow h-full"
                    >
                      <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold-dark text-lg">
                        {tool.icon}
                      </span>
                      <span className="block font-display font-semibold text-charcoal">{tool.title}</span>
                      <span className="block text-sm text-charcoal/50">{tool.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
