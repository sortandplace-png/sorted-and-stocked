// components/PropertiesPickerList.tsx
// SS-372. Regrouped per Racquel's screenshot feedback: households were
// rendering as their own card (chevron-expand, "N PROPERTIES" eyebrow),
// visually indistinguishable from a property card except for that one
// label -- and on expand, the household's properties dropped into the next
// available grid cells rather than under their parent, so Main/Country
// visually sat under Low. Households are now a heading (D-01/D-11 label +
// hairline), never a card of their own -- D-21 (no arrows/chevrons, ever)
// and D-03 (every real card gets a pin dot) follow from that. One flat
// grid, not one grid per household, so headings can sit inline as
// full-width separator rows and "Add a property" can be the grid's own
// last cell (D-22) instead of a separate full-width strip below it.
import { Fragment } from 'react';
import { Home, Plus } from 'lucide-react';
import Tile from '@/components/ui/Tile';

export type PropertyEntry = { id: string; name: string; role: string };
export type HouseholdGroup = { key: string; householdName: string | null; properties: PropertyEntry[] };

export default function PropertiesPickerList({ groups }: { groups: HouseholdGroup[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 mb-6">
      {groups.map((group) => (
        <Fragment key={group.key}>
          {/* Heading only for a household that actually holds more than one
              property -- Lax/Low style single-property households whose
              household name already equals the property name would just
              print the same word twice. D-24: compose from Tile/Pin, not
              hand-rolled -- this one row is plain layout, not a tile, so it
              intentionally isn't one. */}
          {group.properties.length > 1 && (
            <div key={`${group.key}-heading`} className="col-span-2 flex items-center gap-2 mt-2 first:mt-0">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass whitespace-nowrap">
                {group.householdName ?? 'Household'}
              </span>
              <span className="flex-1 border-t border-cardBorder" aria-hidden="true" />
            </div>
          )}
          {group.properties.map((property) => {
            // Staff land on their dedicated My Day page instead of
            // Dashboard -- owner/manager's landing page is unchanged.
            const destination = property.role === 'staff' ? 'my-day' : 'dashboard';
            return (
              <Tile
                key={property.id}
                href={`/properties/${property.id}/${destination}`}
                eyebrow={property.role}
                label={property.name}
                icon={<Home size={20} className="text-denim" aria-hidden="true" />}
                centered
              />
            );
          })}
        </Fragment>
      ))}
      <Tile href="/properties/new" label="Add a property" icon={<Plus size={20} className="text-denim" aria-hidden="true" />} centered />
    </div>
  );
}
