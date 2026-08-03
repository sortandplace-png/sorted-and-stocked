// components/PropertiesPickerList.tsx
// SS-372, third pass. History matters here because this has now swung twice:
// households began as their own expandable CARD (chevron, "N PROPERTIES"
// eyebrow), became HEADING ROWS with hairlines, and are now neither -- the
// household name simply is each card's eyebrow. Five properties did not
// need four heading rows and four rules drawn around them; that was more
// structure than the content justified.
//
// The eyebrow therefore carries the household, not the role. That reverses
// the "eyebrow is the role only" line in the original SS-372 ticket, on
// Racquel's explicit call -- so role is no longer displayed anywhere on
// this screen. It still DRIVES behaviour (staff land on My Day, everyone
// else on Dashboard), it is just no longer shown.
//
// Grouping is retained even with the headings gone: it is what keeps a
// household's properties adjacent in the grid, which is the whole reason
// the grouping existed before the headings were ever drawn.
import { Home, Plus } from 'lucide-react';
import Tile from '@/components/ui/Tile';
import { isConsoleAccentProperty } from '@/lib/property-accent';

export type PropertyEntry = { id: string; name: string; role: string; featureFlags?: Record<string, unknown> | null };
export type HouseholdGroup = { key: string; householdName: string | null; properties: PropertyEntry[] };

export default function PropertiesPickerList({ groups }: { groups: HouseholdGroup[] }) {
  // Flattened so the grid is one continuous run of cards with nothing
  // structural interrupting it -- the ordering still comes from the groups.
  const cards = groups.flatMap((group) =>
    group.properties.map((property) => ({ property, householdName: group.householdName }))
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
      {cards.map(({ property, householdName }) => {
        // Staff land on their dedicated My Day page instead of Dashboard --
        // owner/manager's landing page is unchanged.
        const destination = property.role === 'staff' ? 'my-day' : 'dashboard';
        return (
          <Tile
            key={property.id}
            href={`/properties/${property.id}/${destination}`}
            // Undefined rather than a role fallback when a property has no
            // household at all: Tile omits the eyebrow entirely for
            // undefined, and putting a role in the slot for just those
            // cards would put two different kinds of thing in one place --
            // which is the exact complaint that started SS-372.
            // SS-459 conditional label rule in this card's idiom: when the
            // household is named identically to the property (Lax/Lax,
            // Low/Low, Henderson/Henderson) the eyebrow would duplicate the
            // label directly above it -- so it is omitted, and only Country
            // and Main gain their "Strauss" prefix.
            eyebrow={householdName && householdName !== property.name ? householdName : undefined}
            label={property.name}
            icon={<Home size={20} className="text-denim" aria-hidden="true" />}
            centered
            // The operator-console rose treatment (SS-459: permanent,
            // flag-driven, never keyed on the property name).
            consoleAccent={isConsoleAccentProperty(property.featureFlags)}
          />
        );
      })}
      <Tile href="/properties/new" label="Add a property" icon={<Plus size={20} className="text-denim" aria-hidden="true" />} centered />
    </div>
  );
}
