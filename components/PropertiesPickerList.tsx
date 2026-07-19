// components/PropertiesPickerList.tsx
// One box per household; a household with more than one property expands
// on click to reveal the choice, rather than every property listing flat
// at the top level. Scales to any number of households/properties -- not
// hardcoded to one household with exactly two properties.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export type PropertyEntry = { id: string; name: string; role: string };
export type HouseholdGroup = { key: string; householdName: string | null; properties: PropertyEntry[] };

function PropertyLink({ property, compact }: { property: PropertyEntry; compact?: boolean }) {
  // Staff land on their dedicated My Day page instead of Dashboard --
  // owner/manager's landing page is unchanged.
  const destination = property.role === 'staff' ? 'my-day' : 'dashboard';
  return (
    <Link
      href={`/properties/${property.id}/${destination}`}
      className={`flex items-center justify-between bg-card rounded-xl2 shadow-card hover:shadow-cardHover transition-shadow ${
        compact ? 'px-4 py-2.5' : 'px-4 py-3'
      }`}
    >
      <span className={`text-denim ${compact ? 'text-sm' : ''}`}>{property.name}</span>
      <span className="text-xs text-dusk capitalize">{property.role}</span>
    </Link>
  );
}

export default function PropertiesPickerList({ groups }: { groups: HouseholdGroup[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <ul className="space-y-2 mb-6">
      {groups.map((group) => {
        if (group.properties.length === 1) {
          return (
            <li key={group.key}>
              <PropertyLink property={group.properties[0]} />
            </li>
          );
        }

        const isExpanded = expandedKey === group.key;
        return (
          <li key={group.key}>
            <button
              onClick={() => setExpandedKey(isExpanded ? null : group.key)}
              aria-expanded={isExpanded}
              className="w-full flex items-center justify-between bg-card rounded-xl2 shadow-card hover:shadow-cardHover transition-shadow px-4 py-3"
            >
              <span className="text-denim">{group.householdName ?? 'Properties'}</span>
              <span className="flex items-center gap-1.5 text-xs text-dusk">
                {group.properties.length} properties
                <ChevronDown size={14} strokeWidth={2} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
            {isExpanded && (
              <ul className="mt-1.5 ml-3 space-y-1.5 border-l-2 border-brass/30 pl-3">
                {group.properties.map((property) => (
                  <li key={property.id}>
                    <PropertyLink property={property} compact />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
