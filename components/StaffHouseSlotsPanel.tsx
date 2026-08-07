// components/StaffHouseSlotsPanel.tsx
// SS-824. Staff Slots was scoped to whatever property the console happened
// to be viewing, with nothing on the card naming the house -- "i dont see
// which residence belongs to who," Racquel's own words. This is the fix:
// a house-tile grid in the same idiom as the real sign-in property picker
// (PropertiesPickerList/Tile.tsx), tapping a house opens that house's slots
// below it. Pure selector tiles, not information-holding cards, so no pin --
// same Tile convention ClockInOutButton and the sign-in picker both follow,
// and the same "a card that doesn't hold or do anything doesn't carry a
// dot" rule the SS-823 audit established.
'use client';

import { useState } from 'react';
import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Tile from '@/components/ui/Tile';
import StaffSlotsEditor, { type StaffSlotRow, type SlotMember, type SlotContact } from '@/components/StaffSlotsEditor';

export type HouseSlots = {
  id: string;
  name: string;
  slots: StaffSlotRow[];
  members: SlotMember[];
  assignedNames: Record<string, string>;
  weekMinutesByUser: Record<string, number>;
  contactByUserId: Record<string, SlotContact>;
};

export default function StaffHouseSlotsPanel({
  houses,
  defaultHouseId,
}: {
  houses: HouseSlots[];
  defaultHouseId: string;
}) {
  const t = useTranslations('staffSlots');
  const [selectedId, setSelectedId] = useState(
    houses.some((h) => h.id === defaultHouseId) ? defaultHouseId : (houses[0]?.id ?? '')
  );
  const selected = houses.find((h) => h.id === selectedId);

  if (houses.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-dusk mb-2">{t('chooseHouse')}</p>
        {/* Same grid-cols-2 lg:grid-cols-4 gap-2.5 as PropertiesPickerList --
            "laid out like the sign-in property picker" is a literal ask. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {houses.map((h) => {
            const linked = h.slots.filter((s) => s.user_id).length;
            const active = h.id === selectedId;
            return (
              <Tile
                key={h.id}
                onClick={() => setSelectedId(h.id)}
                active={active}
                pin={false}
                centered
                icon={<Home size={20} className={active ? 'text-white' : 'text-denim'} aria-hidden="true" />}
                label={h.name}
                subtitle={t('slotsLinked', { linked, total: h.slots.length })}
              />
            );
          })}
        </div>
      </div>

      {selected && (
        // key forces a remount on house switch -- StaffSlotsEditor seeds its
        // slots state from initialSlots once, on mount, same as everywhere
        // else it's used; without a key change, switching houses would keep
        // showing the FIRST house's slots under new props.
        <StaffSlotsEditor
          key={selected.id}
          propertyId={selected.id}
          initialSlots={selected.slots}
          assignedNames={selected.assignedNames}
          members={selected.members}
          propertyName={selected.name}
          weekMinutesByUser={selected.weekMinutesByUser}
          contactByUserId={selected.contactByUserId}
          myDayHref={`/properties/${selected.id}/my-day`}
        />
      )}
    </div>
  );
}
