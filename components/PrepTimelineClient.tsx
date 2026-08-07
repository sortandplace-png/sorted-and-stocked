// components/PrepTimelineClient.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getEasternDateStr } from '@/lib/eastern-weekday';
import { SkeletonList } from '@/components/Skeleton';
import { formatMinutes } from '@/lib/format-time';
import { bedikasTolaimIngredients, BEDIKAS_TOLAIM_NOTE } from '@/lib/bedikas-tolaim';
import { isJewishObservant } from '@/lib/observance-gating';

type Entry = {
  id: string;
  course: string;
  recipes: {
    name: string;
    approx_total_minutes: number | null;
    recipe_ingredients: { name: string }[] | null;
  } | null;
  custom_name: string | null;
};

// SS-208. Was new Date().toISOString().slice(0,10) -- the UTC date, which
// from roughly 8pm Eastern defaulted the prep timeline to tomorrow.
function todayStr() {
  return getEasternDateStr(new Date());
}

function minutesToClock(baseMinutes: number, offsetMinutes: number): string {
  const total = baseMinutes - offsetMinutes;
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function PrepTimelineClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const [date, setDate] = useState(todayStr());
  const [readyTime, setReadyTime] = useState('18:00');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Observance gating: the backward-anchor's SOURCE depends on the
  // property. Jewish -> candle lighting for the chosen day (when it has
  // one); not Jewish -> the household's own Evening Anchor dinner time
  // (Settings > Evening Anchor, feature_flags). Same component, same
  // countdown math -- only the seed differs, and only until the person
  // touches the time input themselves (their explicit choice always wins).
  const [jewish, setJewish] = useState(true);
  const [anchorSource, setAnchorSource] = useState<'candles' | 'evening-anchor' | null>(null);
  const timeTouched = useRef(false);

  useEffect(() => {
    supabase
      .from('properties')
      .select('calendar_layers, feature_flags')
      .eq('id', propertyId)
      .single()
      .then(({ data }) => {
        const isJewish = isJewishObservant(data?.calendar_layers as string[] | null | undefined);
        setJewish(isJewish);
        const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
        const dinner = typeof flags.evening_anchor_dinner === 'string' ? flags.evening_anchor_dinner : null;
        if (!isJewish && dinner && !timeTouched.current) {
          setReadyTime(dinner);
          setAnchorSource('evening-anchor');
        }
      });
  }, [propertyId, supabase]);

  // Jewish anchor: /api/hebcal's per-day map carries candleLighting as
  // "H:MM" (evening, so hours < 12 mean PM) for erev Shabbos/Yom Tov.
  // Only days that HAVE a candle lighting re-seed; a plain Tuesday keeps
  // the default or whatever the person set.
  useEffect(() => {
    if (!jewish || timeTouched.current) return;
    const [y, m] = date.split('-');
    fetch(`/api/hebcal?year=${y}&month=${Number(m)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const candle: string | undefined = data?.days?.[date]?.candleLighting;
        if (!candle || timeTouched.current) return;
        const [h, min] = candle.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(min)) return;
        const h24 = h < 12 ? h + 12 : h;
        setReadyTime(`${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        setAnchorSource('candles');
      })
      .catch(() => {});
  }, [jewish, date]);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('meal_plan_entries')
      .select('id, course, custom_name, recipes(name, approx_total_minutes, recipe_ingredients(name))')
      .eq('property_id', propertyId)
      .eq('plan_date', date)
      .then(({ data }) => {
        setEntries((data ?? []) as unknown as Entry[]);
        setLoading(false);
      });
  }, [propertyId, date, supabase]);

  const [readyHour, readyMinute] = readyTime.split(':').map(Number);
  const readyTotalMinutes = readyHour * 60 + readyMinute;

  // Kids Platter is a fixed combo set out ahead of time, not a dish someone
  // is actively cooking -- sorting it into the duration-based countdown by
  // its short prep time (an "Apple slices" entry with a 5-minute
  // approx_total_minutes) put it right before "Ready to serve" instead of
  // treating it as an early, separate task. Pulled out of the countdown
  // entirely (regardless of whether it even has a recorded prep time) and
  // shown as its own fixed early suggestion instead.
  const withTimes = entries
    .filter((e) => e.course !== 'kids_platter' && e.recipes?.approx_total_minutes != null)
    .map((e) => ({
      name: e.recipes!.name,
      minutes: e.recipes!.approx_total_minutes!,
      startClock: minutesToClock(readyTotalMinutes, e.recipes!.approx_total_minutes!),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const noTimeRecorded = entries.filter(
    (e) => e.course !== 'kids_platter' && e.recipes && e.recipes.approx_total_minutes == null
  );
  const customOnly = entries.filter((e) => e.course !== 'kids_platter' && !e.recipes && e.custom_name);
  const kidsPlatterEntries = entries.filter(
    (e) => e.course === 'kids_platter' && (e.recipes?.name || e.custom_name)
  );

  const allIngredientNames = entries.flatMap((e) => e.recipes?.recipe_ingredients?.map((i) => i.name) ?? []);
  const bedikahIngredients = bedikasTolaimIngredients(allIngredientNames);

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Prep Timeline</h1>
      <p className="text-sm text-dusk mb-4">Working backward from when you want dinner ready.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 border border-cardBorder rounded-xl px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={readyTime}
          onChange={(e) => {
            timeTouched.current = true;
            setReadyTime(e.target.value);
          }}
          className="flex-1 border border-cardBorder rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {anchorSource && !timeTouched.current && (
        <p className="text-xs text-dusk mb-4 -mt-2">
          {anchorSource === 'candles'
            ? 'Ready-by time anchored to candle lighting for this day.'
            : "Ready-by time anchored to this house's Evening Anchor dinner time."}
        </p>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-dusk mb-2">Nothing planned for this day yet.</p>
          <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm font-medium text-brass underline">
            Plan a meal for this day →
          </Link>
        </div>
      )}

      {/* Halachic reference -- only meaningful on a Jewish-observant
          property; a civil-only house's timeline stays purely culinary. */}
      {jewish && bedikahIngredients.length > 0 && (
        <div className="bg-sage/10 border border-sage/20 rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-denim mb-1">🔎 Bedikas Tolaim: {bedikahIngredients.join(', ')}</p>
          <p className="text-xs text-dusk">{BEDIKAS_TOLAIM_NOTE}</p>
        </div>
      )}

      {kidsPlatterEntries.length > 0 && (
        <div className="bg-linen border border-cardBorder rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-denim mb-1">🧸 Kids Platter — put out early</p>
          <p className="text-xs text-dusk mb-2">
            30–45 min before serving ({minutesToClock(readyTotalMinutes, 45)}–{minutesToClock(readyTotalMinutes, 30)}) — not part of the cooking countdown:
          </p>
          <ul className="space-y-1">
            {kidsPlatterEntries.map((e) => (
              <li key={e.id} className="text-sm text-denim">
                {e.recipes?.name ?? e.custom_name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {withTimes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm shadow-black/5 p-4 mb-4">
          <ul className="space-y-3">
            {withTimes.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium text-brass w-20 shrink-0">{item.startClock}</span>
                <div className="flex-1 border-l-2 border-cardBorder pl-3">
                  <p className="text-sm text-denim">{item.name}</p>
                  <p className="text-xs text-dusk">~{formatMinutes(item.minutes)}</p>
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="text-sm font-medium text-denim w-20 shrink-0">
                {minutesToClock(readyTotalMinutes, 0)}
              </span>
              <p className="text-sm text-denim font-medium">🍽️ Ready to serve</p>
            </li>
          </ul>
        </div>
      )}

      {(noTimeRecorded.length > 0 || customOnly.length > 0) && (
        <div className="bg-linen rounded-2xl p-4">
          <p className="text-xs text-dusk mb-2">No prep time recorded — can't schedule these:</p>
          <ul className="space-y-1">
            {noTimeRecorded.map((e) => (
              <li key={e.id} className="text-sm text-dusk">
                {e.recipes!.name}
              </li>
            ))}
            {customOnly.map((e) => (
              <li key={e.id} className="text-sm text-dusk">
                {e.custom_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
