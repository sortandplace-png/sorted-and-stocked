// components/ThisWeeksMealsList.tsx
// Client component so the collapse toggle and locale-aware labels (course
// names, recipe name_es, weekday) can react without a page reload -- the
// Dashboard page itself is a Server Component and can't hold this state.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Square, Triangle, Circle } from 'lucide-react';
import Pin from '@/components/PinAccent';

// Bold Direction (Home only) -- saturated fill instead of the app-wide
// softer rust/dairy/sage, matching the approved mockup's high-contrast tags.
const KASHRUT_INFO = {
  Fleishig: { bg: 'bg-fleishigBold', Icon: Square },
  Milchig: { bg: 'bg-milchigBold', Icon: Triangle },
  Parve: { bg: 'bg-parveBold', Icon: Circle },
} as const;

function getKashrut(kosherType: string | null | undefined): keyof typeof KASHRUT_INFO {
  if (kosherType === 'Meat') return 'Fleishig';
  if (kosherType === 'Dairy') return 'Milchig';
  return 'Parve';
}

type MealEntry = {
  course: string;
  recipe_id: string | null;
  recipes: { name: string; name_es: string | null; kosher_type: string | null } | null;
};

export default function ThisWeeksMealsList({
  propertyId,
  mealsByDay,
}: {
  propertyId: string;
  mealsByDay: { date: string; entries: MealEntry[] }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations('dashboard');
  const tCourse = useTranslations('course');
  const locale = useLocale();

  const dayFormatter = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  function formatDay(dateStr: string) {
    // plan_date is a plain "yyyy-MM-dd" -- format in UTC so the date shown
    // never shifts a day depending on the viewer's own timezone. Built from
    // parts (not the locale's default punctuation/order) so this doesn't
    // depend on exactly how each locale spells out its separators.
    const parts = dayFormatter.formatToParts(new Date(`${dateStr}T00:00:00Z`));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const weekday = get('weekday');
    const weekdayCapitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const day = get('day');
    const month = get('month').replace('.', '');
    return locale === 'es' ? `${weekdayCapitalized} • ${day} ${month}` : `${weekdayCapitalized} • ${month} ${day}`;
  }

  return (
    <div>
      <div className="relative w-full flex items-center gap-2 mb-3 pr-6">
        <Pin size="sm" collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <span className="text-xs font-bold uppercase tracking-wider text-denim">
          {t('mealsListCard.heading')}
        </span>
        <span className="text-xs text-dusk">({mealsByDay.reduce((n, d) => n + d.entries.length, 0)})</span>
        <span className="flex-1 border-t border-cardBorder" />
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {mealsByDay.map(({ date, entries }) => (
            <div key={date} className="p-4 bg-linen border border-cardBorder rounded-xl2">
              <div className="font-display font-semibold text-lg text-denim mb-2">{formatDay(date)}</div>
              <div className="space-y-1.5">
                {entries.map((meal, i) => {
                  const k = getKashrut(meal.recipes?.kosher_type);
                  const info = KASHRUT_INFO[k];
                  const courseLabel = tCourse(meal.course);
                  const name = (locale === 'es' && meal.recipes?.name_es) || meal.recipes?.name || t('meal');
                  return (
                    <div key={i} className="flex items-center gap-2 pl-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] text-white rounded font-bold uppercase shrink-0 ${info.bg}`}>
                        <info.Icon className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true" />
                        {k}
                      </span>
                      <span className="text-sm text-denim">
                        {courseLabel && <span className="text-dusk">{courseLabel}: </span>}
                        {meal.recipe_id ? (
                          <Link
                            href={`/properties/${propertyId}/recipes/${meal.recipe_id}`}
                            className="font-semibold underline decoration-cardBorder decoration-2 underline-offset-2 hover:text-brass"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {mealsByDay.length === 0 && (
            <p className="text-sm text-dusk italic py-4">
              {t('mealsListCard.nothingPlanned')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
