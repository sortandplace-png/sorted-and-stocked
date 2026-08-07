// components/meal-plan/OperatorMealPlanOverview.tsx
// LAX OPERATOR AGGREGATE (meal plan half): on the operator-console
// property, /meal-plan renders THIS overview instead of the single-house
// planner -- every property the operator belongs to, grouped by house,
// one row per house per day for the current week. Read-only-safe by
// construction: nothing here writes; each house links to its own real
// meal plan and the header note says that's where changes happen.
// EN-only on purpose -- operator surfaces carry no Spanish (SS-436
// carve-out from R19).
import Link from 'next/link';
import Pin from '@/components/PinAccent';
import { useCardCollapse } from '@/lib/useCardCollapse';

export type OperatorMealPlanDay = {
  date: string; // yyyy-mm-dd
  dishes: string[];
};

export type OperatorMealPlanHouse = {
  propertyId: string;
  propertyName: string;
  days: OperatorMealPlanDay[];
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// SS-823: was decorative -- one card per house, pin did nothing. Extracted
// so each house gets its own useCardCollapse call (one hook instance per
// rendered house), localStorage-persisted same as every other fix tonight.
function HouseCard({ house }: { house: OperatorMealPlanHouse }) {
  const { collapsed, toggle } = useCardCollapse(`operator-meal-plan-${house.propertyId}`);
  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" collapsed={collapsed} onToggle={toggle} />
      <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5 flex items-center justify-between gap-3">
        <span>{house.propertyName}</span>
        <Link
          href={`/properties/${house.propertyId}/meal-plan`}
          className="normal-case tracking-normal text-[11px] font-medium text-white/80 hover:text-white underline underline-offset-2"
        >
          Open {house.propertyName}&rsquo;s plan →
        </Link>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <ul>
            {house.days.map((day) => (
              <li
                key={day.date}
                className="flex items-baseline gap-3 px-5 py-2.5 border-b border-cardBorder/60 last:border-b-0"
              >
                <span className="text-xs font-medium text-brass w-24 shrink-0">{dayLabel(day.date)}</span>
                <span className={`text-sm min-w-0 ${day.dishes.length ? 'text-denim' : 'text-dusk'}`}>
                  {day.dishes.length ? day.dishes.join(' · ') : 'Nothing planned'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function OperatorMealPlanOverview({ houses }: { houses: OperatorMealPlanHouse[] }) {
  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Meal Plan — All Houses</h1>
      <p className="text-sm text-dusk mb-5">
        This week across every house you belong to. Open a house to change its plan — edits happen there, not here.
      </p>

      {houses.length === 0 && (
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-xl2 border border-cardBorder shadow-card">
          No houses to show.
        </p>
      )}

      <div className="space-y-4">
        {houses.map((house) => (
          <HouseCard key={house.propertyId} house={house} />
        ))}
      </div>
    </div>
  );
}
