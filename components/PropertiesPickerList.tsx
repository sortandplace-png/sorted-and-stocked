// components/PropertiesPickerList.tsx
// One box per household; a household with more than one property expands
// on click to reveal the choice, rather than every property listing flat
// at the top level. Scales to any number of households/properties -- not
// hardcoded to one household with exactly two properties.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Home } from 'lucide-react';

export type PropertyEntry = { id: string; name: string; role: string };
export type HouseholdGroup = { key: string; householdName: string | null; properties: PropertyEntry[] };

// Real /sitemap tile language (bg-mist, border-brass/30, rounded-xl2,
// shadow-card, eyebrow label, icon, centered name) -- was a plain rounded
// rectangle with left-aligned text, not a tile at all. Pin dot deliberately
// left off (unlike /sitemap's own tiles): Rule 3 narrowed to group-level
// collapse controls only, and these are per-item data rows, not a fixed
// nav-tile set.
function PropertyTile({ property, compact }: { property: PropertyEntry; compact?: boolean }) {
  // Staff land on their dedicated My Day page instead of Dashboard --
  // owner/manager's landing page is unchanged.
  const destination = property.role === 'staff' ? 'my-day' : 'dashboard';
  return (
    <Link
      href={`/properties/${property.id}/${destination}`}
      className={`flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow text-center ${
        compact ? 'min-h-[64px] py-2 px-2' : 'min-h-[80px] py-[10px] px-[14px]'
      }`}
    >
      <span className="text-[8px] tracking-[0.2em] uppercase font-semibold text-brass">{property.role}</span>
      <Home size={20} className="text-denim" aria-hidden="true" />
      <span className={`font-display font-normal text-denim ${compact ? 'text-[12px]' : 'text-[14px]'}`}>{property.name}</span>
    </Link>
  );
}

export default function PropertiesPickerList({ groups }: { groups: HouseholdGroup[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-2.5">
        {groups.map((group) => {
          if (group.properties.length === 1) {
            return <PropertyTile key={group.key} property={group.properties[0]} />;
          }
          const isExpanded = expandedKey === group.key;
          return (
            <button
              key={group.key}
              onClick={() => setExpandedKey(isExpanded ? null : group.key)}
              aria-expanded={isExpanded}
              className="flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow text-center min-h-[80px] py-[10px] px-[14px]"
            >
              <span className="text-[8px] tracking-[0.2em] uppercase font-semibold text-brass">
                {group.properties.length} properties
              </span>
              <Home size={20} className="text-denim" aria-hidden="true" />
              <span className="font-display font-normal text-[14px] text-denim flex items-center gap-1">
                {group.householdName ?? 'Properties'}
                <ChevronDown size={12} strokeWidth={2.5} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
      {groups
        .filter((g) => g.properties.length > 1 && expandedKey === g.key)
        .map((group) => (
          <div key={group.key} className="grid grid-cols-3 gap-2 mt-2.5 ml-3 border-l-2 border-brass/30 pl-3">
            {group.properties.map((property) => (
              <PropertyTile key={property.id} property={property} compact />
            ))}
          </div>
        ))}
    </div>
  );
}
