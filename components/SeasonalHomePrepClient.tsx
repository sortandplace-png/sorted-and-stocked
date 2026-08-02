// components/SeasonalHomePrepClient.tsx
// The non-Jewish swap for Halachic Calendar (observance gating amendment,
// 31 Jul 2026): same Tools grid position, same modal treatment, neutral
// content -- where the year stands, what's coming up on the civil
// calendar, and what the house should be getting ready for this season.
// Sits behind the 'seasonal-home-prep' slug that
// lib/observance-gating.ts swaps in for a property without the jewish
// calendar layer; a Jewish-observant property never sees this tile.
//
// Same Concept B card shell as HalachicCalendarClient (whose grid slot
// this inherits), and the same static-reference-list pattern as its
// Bedikas Tolaim card. Season boundaries are meteorological (1 Mar /
// 1 Jun / 1 Sep / 1 Dec) -- fixed dates, no astronomy dependency, and
// the "prep the house" rhythm tracks weather months, not equinoxes.
'use client';

import { format } from 'date-fns';
import { useLocale } from 'next-intl';
import { usFederalHolidays } from '@/lib/us-holidays';
import Pin from '@/components/PinAccent';
import { CardHeader } from '@/components/ShiftHandoverClient';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" />
      <CardHeader>{title}</CardHeader>
      <div className="p-4">{children}</div>
    </div>
  );
}

type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

// Month is 1-12. Meteorological seasons: Mar-May / Jun-Aug / Sep-Nov / Dec-Feb.
function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
}

// Next season's first day, from a real date -- Dec wraps into next year.
function nextSeasonStart(d: Date): { season: Season; start: Date } {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m < 3) return { season: 'Spring', start: new Date(y, 2, 1) };
  if (m < 6) return { season: 'Summer', start: new Date(y, 5, 1) };
  if (m < 9) return { season: 'Fall', start: new Date(y, 8, 1) };
  if (m < 12) return { season: 'Winter', start: new Date(y, 11, 1) };
  return { season: 'Spring', start: new Date(y + 1, 2, 1) };
}

const SEASONAL_PREP: Record<Season, { item: string; note: string }[]> = {
  Spring: [
    { item: 'Deep clean, room by room', note: 'Windows, baseboards, behind appliances — the once-a-year pass.' },
    { item: 'HVAC filter & AC check', note: 'Swap filters and test cooling before the first hot week.' },
    { item: 'Rotate pantry stock', note: 'Pull winter staples forward, check expiration dates as you go.' },
    { item: 'Outdoor furniture & grill', note: 'Wash down, check propane, restock outdoor entertaining supplies.' },
  ],
  Summer: [
    { item: 'Stock for heat', note: 'Extra water, freezer pops, sunscreen by the door.' },
    { item: 'Pest check', note: 'Ants and pantry moths peak now — inspect dry goods and seals.' },
    { item: 'Guest-season restock', note: 'Linens, toiletries, and breakfast staples ahead of visitors.' },
    { item: 'Storm readiness', note: 'Flashlights, batteries, and a cooler plan for outages.' },
  ],
  Fall: [
    { item: 'Heating check & filter swap', note: 'Run the heat once before the first cold night, not during it.' },
    { item: 'Gutters & drainage', note: 'Clear before the leaves finish coming down.' },
    { item: 'Holiday pantry build-up', note: 'Baking staples and roasting supplies before the seasonal rush.' },
    { item: 'Swap seasonal linens', note: 'Heavier bedding out of storage, summer set washed and stored.' },
  ],
  Winter: [
    { item: 'Pipe & draft protection', note: 'Insulate exposed pipes; check door and window seals.' },
    { item: 'Salt, shovels & mats', note: 'Entryway winter kit stocked before the first storm.' },
    { item: 'Emergency basics', note: 'Batteries, lanterns, and a few days of shelf-stable food.' },
    { item: 'Humidifier & filter care', note: 'Clean tanks weekly; dry indoor air is a whole-season issue.' },
  ],
};

export default function SeasonalHomePrepClient() {
  const locale = useLocale();
  const es = locale === 'es';

  const now = new Date();
  const season = seasonOf(now.getMonth() + 1);
  const next = nextSeasonStart(now);
  const daysUntilNext = Math.ceil((next.start.getTime() - now.getTime()) / 86400000);

  // This year's remaining holidays, topped up from next year so the card
  // always shows three -- same data (lib/us-holidays) the month grid's
  // civil layer renders, not a second list to drift.
  const todayIso = format(now, 'yyyy-MM-dd');
  const upcoming = [...usFederalHolidays(now.getFullYear()), ...usFederalHolidays(now.getFullYear() + 1)]
    .filter((h) => h.date >= todayIso)
    .slice(0, 3);

  return (
    <div className="bg-mist p-4 space-y-4">
      <h1 className="text-2xl font-display text-denim mb-1">Seasonal & Home Prep</h1>

      <Card title="Where the Year Stands">
        <p className="text-sm font-medium text-denim">{season}</p>
        <p className="text-xs text-dusk mt-1">
          {next.season} begins {format(next.start, 'MMMM d')} — {daysUntilNext} day{daysUntilNext === 1 ? '' : 's'} out.
        </p>
      </Card>

      {upcoming.length > 0 && (
        <Card title="Upcoming">
          <ul className="space-y-1.5">
            {upcoming.map((h) => (
              <li key={h.date} className="flex items-center justify-between text-sm gap-3">
                <span className="font-medium text-denim">{es ? h.name_es : h.name_en}</span>
                <span className="text-dusk shrink-0">{format(new Date(`${h.date}T00:00:00`), 'MMM d')}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`${season} Prep Reference`}>
        <ul className="space-y-2">
          {SEASONAL_PREP[season].map((entry) => (
            <li key={entry.item}>
              <p className="text-sm font-medium text-denim">{entry.item}</p>
              <p className="text-xs text-dusk">{entry.note}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
