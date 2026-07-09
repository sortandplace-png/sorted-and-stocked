'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Printer, Flame, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { kosherIcon } from '@/lib/icon-maps';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { COURSES, type Course } from '@/lib/course-constants';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';

type Recipe = {
  id: string;
  name: string;
  name_es: string | null;
  photo_url: string | null;
  course: Course | null;
  kosher_type: string | null;
  is_shabbos_only: boolean | null;
  tags: string[] | null;
  approx_total_minutes: number | null;
};

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

type Entry = {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  course: Course;
  recipe_id: string | null;
  custom_name: string | null;
  recipes: Recipe | null;
};

type DayData = { date: string; entries: Entry[]; hasMeatDairyBuffer: boolean };

type HebcalDay = {
  hebrewDate?: string;
  isYomTov: boolean;
  isFast: boolean;
  isErevShabbos: boolean;
  candleLighting?: string;
  titles: string[];
};

// Distinct from Hebcal's generic isFast flag above — this is the curated
// fast_days table, which carries the severity + meal-specific note text
// that Hebcal's calendar API has no concept of.
type FastDay = {
  holiday_name: string;
  severity: 'major' | 'minor';
  note: string;
};

const KIDS_PLATTERS = [
  'Platter A — carrots, apples, grapes',
  'Platter B — berries, cheese cubes',
  'Platter C — melon, crackers',
  'Platter D — cucumbers, pretzels, hummus',
  'Platter E — clementines, string cheese, crackers',
  'Platter F — cherry tomatoes, pita, olives',
  'Platter G — apple slices, peanut butter, raisins',
  'Platter H — grapes, cheese sticks, mini muffins',
];

// Zmanim-Aware Prep Guard: warns when a day's total recorded prep time
// wouldn't fit before candle-lighting. Confirmed with Racquel: uses
// recipes.approx_total_minutes (only populated on ~60% of recipes — a day
// with no timed recipes just isn't checked, never warns off missing data),
// triggers on any day with a real candle-lighting time (covers both Erev
// Shabbos and Erev Yom Tov since both fire Hebcal's "candles" category),
// assumes a 9:00 AM prep start since no real "when do you start cooking"
// data exists anywhere in the app to use instead.
const ASSUMED_PREP_START_MINUTES = 9 * 60;

function parseCandleLightingMinutes(candleLighting: string): number {
  const [h, m] = candleLighting.split(':').map(Number);
  // Candle lighting is always evening — the extracted "H:MM" has no AM/PM
  // marker, so any hour read as under 12 is actually that many hours past noon.
  const hour24 = h < 12 ? h + 12 : h;
  return hour24 * 60 + m;
}

function getPrepWarning(entries: Entry[], candleLighting: string | undefined): boolean {
  if (!candleLighting) return false;
  const totalMinutes = entries.reduce((sum, e) => sum + (e.recipes?.approx_total_minutes ?? 0), 0);
  if (totalMinutes === 0) return false;
  return ASSUMED_PREP_START_MINUTES + totalMinutes > parseCandleLightingMinutes(candleLighting);
}

// Same check RecipesGridView uses — recipe photos come from varied hosts.
function isDirectImageUrl(url: string) {
  if (url.startsWith('/')) return true;
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekRange(anchor: Date) {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return { start: days[0], end: days[6], days };
}

function monthRange(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return { start, end, days };
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MealPlanView({
  propertyId,
  recipes,
}: {
  propertyId: string;
  recipes: Recipe[];
}) {
  const role = usePropertyRole();
  const canEdit = canManage(role);
  const t = useTranslations('calendar');
  const tCourse = useTranslations('course');
  const locale = useLocale();
  const supabase = createClient();
  const showToast = useToast();

  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [hebcal, setHebcal] = useState<Record<string, HebcalDay>>({});
  const [fastDays, setFastDays] = useState<Record<string, FastDay>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushingToShopping, setPushingToShopping] = useState(false);
  const [justGeneratedList, setJustGeneratedList] = useState(false);
  const [repeatingWeek, setRepeatingWeek] = useState(false);
  const [extending, setExtending] = useState(false);

  const [editing, setEditing] = useState<{ date: string; course: Course } | null>(null);
  const [pickerMode, setPickerMode] = useState<'existing' | 'custom'>('existing');
  const [showIntentStep, setShowIntentStep] = useState(false);
  const [swapIntent, setSwapIntent] = useState<
    'too_much_work' | 'kids_wont_eat' | 'quicker' | 'different_protein' | null
  >(null);
  const [pickedRecipeId, setPickedRecipeId] = useState('');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [kosherFilter, setKosherFilter] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);

  const range = viewMode === 'week' ? weekRange(anchor) : monthRange(anchor);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    const start = fmt(range.start);
    const end = fmt(range.end);

    const { data: entries, error: fetchError } = await supabase
      .from('meal_plan_entries')
      .select(
        'id, plan_date, meal_slot, course, custom_name, recipe_id, recipes(id, name, name_es, photo_url, kosher_type, is_shabbos_only, approx_total_minutes)'
      )
      .eq('property_id', propertyId)
      .gte('plan_date', start)
      .lte('plan_date', end)
      .order('plan_date');

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const byDate: Record<string, DayData> = {};
    for (const entry of (entries ?? []) as unknown as Entry[]) {
      if (!byDate[entry.plan_date]) {
        byDate[entry.plan_date] = { date: entry.plan_date, entries: [], hasMeatDairyBuffer: false };
      }
      byDate[entry.plan_date].entries.push(entry);
    }
    for (const day of Object.values(byDate)) {
      const kosherTypes = new Set(day.entries.map((e) => e.recipes?.kosher_type).filter(Boolean));
      day.hasMeatDairyBuffer = kosherTypes.has('Meat') && kosherTypes.has('Dairy');
    }
    setDays(byDate);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();

    const year = range.start.getFullYear();
    const month = range.start.getMonth() + 1;
    fetch(`/api/hebcal?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setHebcal(data.days ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, anchor.getTime(), propertyId]);

  // Reference table, not property-scoped — fetched once, not tied to the
  // visible date range like hebcal above.
  useEffect(() => {
    supabase
      .from('fast_days')
      .select('date, holiday_name, severity, note')
      .then(({ data }) => {
        const byDate: Record<string, FastDay> = {};
        for (const row of data ?? []) {
          byDate[row.date] = { holiday_name: row.holiday_name, severity: row.severity, note: row.note };
        }
        setFastDays(byDate);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recipeTitle(r: Recipe) {
    return locale === 'es' && r.name_es ? r.name_es : r.name;
  }

  function entryFor(dateStr: string, course: Course) {
    return days[dateStr]?.entries.find((e) => e.course === course) ?? null;
  }

  function displayName(entry: Entry | null) {
    if (!entry) return null;
    return entry.recipes ? recipeTitle(entry.recipes) : entry.custom_name;
  }

  function openPicker(dateStr: string, course: Course, isSwap = false) {
    if (!canEdit) return;
    const recipesForCourse = recipes.filter((r) => r.course === course);
    setEditing({ date: dateStr, course });
    setPickerMode(recipesForCourse.length > 0 ? 'existing' : 'custom');
    setPickedRecipeId(recipesForCourse[0]?.id ?? '');
    setCustomName('');
    setRecipeSearch('');
    setKosherFilter(null);
    setSwapIntent(null);
    // Only a real swap (an already-filled slot) gets the "why" step —
    // filling an empty slot for the first time has nothing to swap away from.
    setShowIntentStep(isSwap && recipesForCourse.length > 0);
  }

  async function saveEntry() {
    if (!editing) return;
    setSaving(true);

    const existing = entryFor(editing.date, editing.course);
    if (existing) {
      await resilientDelete(supabase, 'meal_plan_entries', { id: existing.id });
    }

    const payload =
      pickerMode === 'existing' && pickedRecipeId
        ? {
            property_id: propertyId,
            plan_date: editing.date,
            course: editing.course,
            recipe_id: pickedRecipeId,
            meal_slot: 'dinner',
          }
        : {
            property_id: propertyId,
            plan_date: editing.date,
            course: editing.course,
            custom_name: customName.trim(),
            meal_slot: 'dinner',
          };

    const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }

    setEditing(null);
    loadEntries();
  }

  async function clearEntry(dateStr: string, course: Course) {
    const existing = entryFor(dateStr, course);
    if (!existing) return;
    await resilientDelete(supabase, 'meal_plan_entries', { id: existing.id });
    loadEntries();
  }

  async function generateShoppingList() {
    setPushingToShopping(true);
    const week = weekRange(anchor);
    const weekEntries = Object.values(days)
      .filter((d) => d.date >= fmt(week.start) && d.date <= fmt(week.end))
      .flatMap((d) => d.entries);
    const recipeIds = weekEntries.map((e) => e.recipe_id).filter((id): id is string => !!id);

    if (recipeIds.length === 0) {
      setPushingToShopping(false);
      showToast('No linked recipes this week — nothing to add.');
      return;
    }

    const { data: ingredients, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select('name, quantity, unit, category, recipe_id')
      .in('recipe_id', recipeIds);

    if (ingredientsError || !ingredients) {
      setPushingToShopping(false);
      showToast('Failed to load ingredients.', { variant: 'error' });
      return;
    }

    const result = await addIngredientsToShoppingList(supabase, propertyId, ingredients);
    setPushingToShopping(false);

    if (!result.ok) {
      showToast(result.error, { variant: 'error' });
      return;
    }

    showToast(`Added ${result.count} ingredient${result.count === 1 ? '' : 's'} to Shopping.`, {
      variant: 'success',
    });
    setJustGeneratedList(true);
  }

  async function repeatWeekForward() {
    setRepeatingWeek(true);
    const week = weekRange(anchor);
    const thisWeekEntries = Object.values(days).flatMap((d) => d.entries);

    if (thisWeekEntries.length === 0) {
      setRepeatingWeek(false);
      showToast('Nothing planned this week to copy.');
      return;
    }

    const nextWeekStart = new Date(week.start);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    // Don't overwrite anything already planned next week — only fill gaps.
    const { data: existing } = await supabase
      .from('meal_plan_entries')
      .select('plan_date, course')
      .eq('property_id', propertyId)
      .gte('plan_date', fmt(nextWeekStart))
      .lte('plan_date', fmt(nextWeekEnd));
    const existingKeys = new Set((existing ?? []).map((e) => `${e.plan_date}:${e.course}`));

    let inserted = 0;
    for (const entry of thisWeekEntries) {
      const dayOffset = Math.round(
        (new Date(entry.plan_date).getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newDate = new Date(nextWeekStart);
      newDate.setDate(newDate.getDate() + dayOffset);
      const newDateStr = fmt(newDate);

      if (existingKeys.has(`${newDateStr}:${entry.course}`)) continue;

      const payload = entry.recipe_id
        ? {
            property_id: propertyId,
            plan_date: newDateStr,
            course: entry.course,
            recipe_id: entry.recipe_id,
            meal_slot: entry.meal_slot,
          }
        : {
            property_id: propertyId,
            plan_date: newDateStr,
            course: entry.course,
            custom_name: entry.custom_name,
            meal_slot: entry.meal_slot,
          };

      const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
      if (result.ok) inserted++;
    }

    setRepeatingWeek(false);
    showToast(`Copied ${inserted} meal${inserted === 1 ? '' : 's'} to next week.`, { variant: 'success' });
    loadEntries();
  }

  // Extends past wherever the plan currently ends — not tied to whatever
  // week is on screen — by repeating the last populated week's pattern
  // forward, same skip-if-already-planned rule as repeatWeekForward.
  async function extendMealPlan(weeks: number) {
    setExtending(true);

    const { data: lastRow } = await supabase
      .from('meal_plan_entries')
      .select('plan_date')
      .eq('property_id', propertyId)
      .order('plan_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastRow) {
      setExtending(false);
      showToast('No existing meal plan to extend from.', { variant: 'error' });
      return;
    }

    const lastDate = new Date(lastRow.plan_date);
    const templateWeek = weekRange(lastDate);

    const { data: templateEntries } = await supabase
      .from('meal_plan_entries')
      .select('plan_date, meal_slot, course, recipe_id, custom_name')
      .eq('property_id', propertyId)
      .gte('plan_date', fmt(templateWeek.start))
      .lte('plan_date', fmt(templateWeek.end));

    if (!templateEntries || templateEntries.length === 0) {
      setExtending(false);
      showToast('Could not find a template week to repeat.', { variant: 'error' });
      return;
    }

    let inserted = 0;
    for (let w = 1; w <= weeks; w++) {
      for (const entry of templateEntries) {
        const dayOffset = Math.round(
          (new Date(entry.plan_date).getTime() - templateWeek.start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const newDate = new Date(templateWeek.start);
        newDate.setDate(newDate.getDate() + 7 * w + dayOffset);

        const payload = entry.recipe_id
          ? {
              property_id: propertyId,
              plan_date: fmt(newDate),
              course: entry.course,
              recipe_id: entry.recipe_id,
              meal_slot: entry.meal_slot,
            }
          : {
              property_id: propertyId,
              plan_date: fmt(newDate),
              course: entry.course,
              custom_name: entry.custom_name,
              meal_slot: entry.meal_slot,
            };

        const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
        if (result.ok) inserted++;
      }
    }

    setExtending(false);
    showToast(`Extended the meal plan by ${weeks} week${weeks === 1 ? '' : 's'} (${inserted} meals added).`, {
      variant: 'success',
    });
    loadEntries();
  }

  // Kids Platter has almost no recipes of its own course (it was always a
  // fixed-combo slot) — surface fruit/veg recipes tagged "kids-friendly"
  // alongside it too, without pulling them out of their real vege/salad
  // course everywhere else in the app.
  const recipesForEditingCourse = editing
    ? recipes
        .filter((r) =>
          r.course === editing.course ||
          (editing.course === 'kids_platter' && r.tags?.includes('kids-friendly'))
        )
        .filter(matchesSwapIntent)
    : [];

  // "Different protein" has no real backing field to filter on (no
  // protein-type column exists anywhere) — it's offered as a reason but
  // doesn't narrow the list beyond course, unlike the other three.
  function matchesSwapIntent(r: Recipe): boolean {
    if (!swapIntent) return true;
    if (swapIntent === 'kids_wont_eat') return !!r.tags?.includes('kids-friendly');
    if (swapIntent === 'too_much_work') return (r.approx_total_minutes ?? 999) <= 30;
    if (swapIntent === 'quicker') return (r.approx_total_minutes ?? 999) <= 20;
    return true;
  }
  const weekDates = weekRange(anchor).days;
  const isCurrentOrFutureWeek = weekDates[0] >= new Date(fmt(new Date()));

  if (loading && Object.keys(days).length === 0) return <SkeletonList rows={2} />;

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      <div className="hidden print:block mb-3">
        <h1 className="font-display text-2xl text-charcoal">
          {viewMode === 'week' ? 'Meal Plan' : 'Meal Plan — ' + anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h1>
        {viewMode === 'week' && (
          <p className="text-sm text-charcoal/50">
            {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {error && (
        <p className="print:hidden text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-gold-light/60 bg-white p-0.5 text-sm">
          <button
            onClick={() => setViewMode('week')}
            className={`rounded-full px-4 py-1.5 ${viewMode === 'week' ? 'bg-gold-dark text-white' : 'text-charcoal/60'}`}
          >
            {t('week')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`rounded-full px-4 py-1.5 ${viewMode === 'month' ? 'bg-gold-dark text-white' : 'text-charcoal/60'}`}
          >
            {t('month')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold px-3 py-1.5 text-xs font-medium text-gold-dark"
          >
            <Printer className="h-3.5 w-3.5" />
            {viewMode === 'week' ? t('printWeek') : t('printMonth')}
          </button>
          {canEdit && viewMode === 'week' && (
            <button
              onClick={repeatWeekForward}
              disabled={repeatingWeek}
              title="Copy this week's meals to next week (won't overwrite anything already planned)"
              className="rounded-full border border-gold px-4 py-1.5 text-xs font-medium text-gold-dark disabled:opacity-40"
            >
              {repeatingWeek ? '…' : 'Repeat next week →'}
            </button>
          )}
          {canEdit && viewMode === 'week' && (
            <button
              onClick={generateShoppingList}
              disabled={pushingToShopping}
              className="rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {pushingToShopping ? '…' : t('generateShoppingList')}
            </button>
          )}
          {canEdit && viewMode === 'week' && (
            <button
              onClick={() => extendMealPlan(4)}
              disabled={extending}
              title="Repeat the last planned week forward 4 more weeks, wherever the plan currently ends"
              className="rounded-full border border-charcoal/30 px-4 py-1.5 text-xs font-medium text-charcoal disabled:opacity-40"
            >
              {extending ? '…' : 'Extend plan +4 weeks'}
            </button>
          )}
        </div>
      </div>

      {canEdit && viewMode === 'week' && (
        <div className="print:hidden -mt-2 mb-4 flex items-center justify-between flex-wrap gap-1">
          <p className="text-xs text-charcoal/40">
            Only courses linked to a saved recipe (not typed-in text) have ingredients to add.
          </p>
          {justGeneratedList && (
            <Link
              href={`/properties/${propertyId}/shopping-list`}
              className="text-xs font-medium text-charcoal underline"
            >
              Go to shopping list →
            </Link>
          )}
        </div>
      )}

      {viewMode === 'week' ? (
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 mb-5">
          {weekDates.map((d, i) => {
            const dateStr = fmt(d);
            const isToday = fmt(new Date()) === dateStr;
            const isShabbos = i === 5 || i === 6;
            const hcal = hebcal[dateStr];
            const day = days[dateStr];
            const fastDay = fastDays[dateStr];
            const hasMajorFastConflict = fastDay?.severity === 'major' && (day?.entries.length ?? 0) > 0;

            return (
              <div
                key={dateStr}
                className={
                  'rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden' +
                  (isToday ? ' ring-2 ring-gold' : '')
                }
              >
                <div
                  className={
                    'flex items-center gap-2 px-4 py-2 ' + (isShabbos ? 'bg-charcoal/10' : 'bg-gold-light/15')
                  }
                >
                  <span className="text-xs font-semibold text-charcoal">{DAY_LABELS[i]}</span>
                  <span className="text-xs text-charcoal/50">
                    {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  {hcal?.isErevShabbos && <Flame className="h-3 w-3 text-gold-dark" />}
                  {day?.hasMeatDairyBuffer && (
                    <span
                      title={t('sameDayWarning')}
                      className="h-2 w-2 rounded-full bg-gold shrink-0"
                    />
                  )}
                  {getPrepWarning(day?.entries ?? [], hcal?.candleLighting) && (
                    <span title="Recorded prep time for this day may not finish before candle-lighting">
                      <AlertTriangle className="h-3.5 w-3.5 text-rust shrink-0" />
                    </span>
                  )}
                  {fastDay?.severity === 'minor' && (
                    <span
                      title={fastDay.note}
                      className="text-[10px] font-medium text-charcoal/60 bg-gold-light/40 px-2 py-0.5 rounded-full shrink-0"
                    >
                      {fastDay.holiday_name}
                    </span>
                  )}
                  {hcal && hcal.titles.length > 0 ? (
                    <span
                      className={
                        'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[60%] ' +
                        (hcal.isFast
                          ? 'text-rust bg-rust/10'
                          : hcal.isYomTov
                          ? 'text-cream bg-charcoal'
                          : 'text-charcoal bg-gold-light/50')
                      }
                      title={hcal.titles.join(' · ')}
                    >
                      ✡︎ {hcal.isFast ? 'Fast: ' : ''}
                      {hcal.titles.join(' · ')}
                    </span>
                  ) : isShabbos ? (
                    <span className="ml-auto text-[10px] font-semibold text-charcoal bg-gold-light/50 px-2 py-0.5 rounded-full">
                      ✨ Shabbos
                    </span>
                  ) : null}
                </div>
                {hasMajorFastConflict && (
                  <div className="flex items-start gap-2 px-4 py-2 bg-rust/10 border-b border-rust/20">
                    <AlertTriangle className="h-4 w-4 text-rust shrink-0 mt-0.5" />
                    <p className="text-xs text-rust font-medium">
                      {fastDay!.holiday_name}: {fastDay!.note}
                    </p>
                  </div>
                )}
                <div className="divide-y divide-gold-light/20">
                  {COURSES.filter(({ key }) => key !== 'dessert' || isShabbos).map(({ key, label, icon }) => {
                    const entry = entryFor(dateStr, key);
                    const name = displayName(entry);
                    const photo = entry?.recipes?.photo_url;
                    const linkedRecipeId = entry?.recipe_id;
                    return (
                      <div key={key} className="flex items-center gap-2.5 px-4 py-2">
                        {photo && isDirectImageUrl(photo) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="w-9 h-9 rounded-lg bg-gold-light/25 shrink-0 flex items-center justify-center text-base">
                            {icon}
                          </span>
                        )}
                        <span className="text-[11px] text-charcoal/40 w-14 shrink-0">{tCourse(key)}</span>
                        {linkedRecipeId ? (
                          <Link
                            href={`/properties/${propertyId}/recipes/${linkedRecipeId}`}
                            className="flex-1 min-w-0 text-sm text-charcoal truncate underline decoration-gold-light decoration-2 underline-offset-2"
                          >
                            {name}
                          </Link>
                        ) : (
                          <button
                            onClick={() => openPicker(dateStr, key)}
                            disabled={!canEdit}
                            className="flex-1 text-left min-w-0 text-sm disabled:cursor-default"
                          >
                            {name ? (
                              <span className="text-charcoal truncate block">{name}</span>
                            ) : (
                              <span className="text-charcoal/25">{canEdit ? '+ add' : ''}</span>
                            )}
                          </button>
                        )}
                        {canEdit && linkedRecipeId && (
                          <button
                            onClick={() => openPicker(dateStr, key, true)}
                            className="text-charcoal/30 text-xs shrink-0"
                            aria-label="Change"
                          >
                            ✏️
                          </button>
                        )}
                        {canEdit && entry && (
                          <button onClick={() => clearEntry(dateStr, key)} className="text-rust text-xs shrink-0">
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <MonthGrid
          days={monthRange(anchor).days}
          data={days}
          hebcal={hebcal}
          fastDays={fastDays}
          recipeTitle={recipeTitle}
          t={t}
          onDayClick={(date) => {
            setAnchor(new Date(date + 'T12:00:00'));
            setViewMode('week');
          }}
        />
      )}

      <div className="print:hidden flex items-center justify-center gap-4 mt-4">
        <button
          onClick={() =>
            setAnchor((d) => {
              const next = new Date(d);
              if (viewMode === 'week') next.setDate(next.getDate() - 7);
              else next.setMonth(next.getMonth() - 1);
              return next;
            })
          }
          disabled={viewMode === 'week' && !isCurrentOrFutureWeek}
          title={viewMode === 'week' && !isCurrentOrFutureWeek ? 'Cannot navigate before today' : undefined}
          className="text-sm text-charcoal underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
        >
          ← Prev
        </button>
        <button onClick={() => setAnchor(new Date())} className="text-sm text-charcoal/50">
          Today
        </button>
        <button
          onClick={() =>
            setAnchor((d) => {
              const next = new Date(d);
              if (viewMode === 'week') next.setDate(next.getDate() + 7);
              else next.setMonth(next.getMonth() + 1);
              return next;
            })
          }
          className="text-sm text-charcoal underline"
        >
          Next →
        </button>
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-charcoal mb-1">
              {COURSES.find((c) => c.key === editing.course)?.icon}{' '}
              {tCourse(editing.course)}
            </h2>
            <p className="text-xs text-charcoal/40 mb-3">
              {new Date(editing.date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>

            {showIntentStep ? (
              <div className="space-y-2">
                <p className="text-sm text-charcoal/60 mb-1">What's the reason for the swap?</p>
                {(
                  [
                    ['too_much_work', 'Too much work'],
                    ['kids_wont_eat', "Kids won't eat it"],
                    ['quicker', 'Need something quicker'],
                    ['different_protein', 'Different protein'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSwapIntent(key);
                      setShowIntentStep(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl bg-cream/60 text-charcoal text-sm border border-gold-light/40 hover:border-gold transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setShowIntentStep(false)}
                  className="w-full text-center text-sm text-charcoal/40 mt-1 py-1"
                >
                  Show me everything →
                </button>
              </div>
            ) : (
              <>
            {swapIntent && (
              <div className="flex items-center justify-between bg-gold-light/15 rounded-xl px-3 py-2 mb-3 text-xs text-charcoal/60">
                <span>
                  Filtered for: {
                    { too_much_work: 'Too much work', kids_wont_eat: "Kids won't eat it", quicker: 'Need something quicker', different_protein: 'Different protein' }[swapIntent]
                  }
                </span>
                <button onClick={() => setSwapIntent(null)} className="text-charcoal/40 underline">
                  Clear
                </button>
              </div>
            )}

            {editing.course === 'kids_platter' && (
              <div className="mb-3">
                <p className="text-xs text-charcoal/50 mb-2">
                  Kids Platter was never really a recipe list — it's always been fixed combos. Tap one, or use
                  Quick entry for something else.
                </p>
                <div className="flex flex-col gap-2">
                  {KIDS_PLATTERS.map((platter) => (
                    <button
                      key={platter}
                      onClick={() => {
                        setPickerMode('custom');
                        setCustomName(platter);
                      }}
                      className={
                        customName === platter && pickerMode === 'custom'
                          ? 'text-left px-4 py-2.5 rounded-2xl bg-gold-light/30 text-charcoal font-medium text-sm border border-gold'
                          : 'text-left px-4 py-2.5 rounded-2xl bg-cream/60 text-charcoal text-sm border border-gold-light/40'
                      }
                    >
                      {platter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setPickerMode('existing')}
                className={
                  pickerMode === 'existing'
                    ? 'flex-1 py-2 rounded-full bg-charcoal text-cream text-sm'
                    : 'flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm'
                }
              >
                Pick a recipe
              </button>
              <button
                onClick={() => setPickerMode('custom')}
                className={
                  pickerMode === 'custom'
                    ? 'flex-1 py-2 rounded-full bg-charcoal text-cream text-sm'
                    : 'flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm'
                }
              >
                Quick entry
              </button>
            </div>

            {pickerMode === 'existing' ? (
              recipesForEditingCourse.length > 0 ? (
                <div className="mb-3">
                  {[...new Set(recipesForEditingCourse.map((r) => r.kosher_type).filter(Boolean))].length > 0 && (
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {[...new Set(recipesForEditingCourse.map((r) => r.kosher_type).filter(Boolean))].map((kt) => (
                        <button
                          key={kt}
                          onClick={() => setKosherFilter(kosherFilter === kt ? null : kt)}
                          className={
                            kosherFilter === kt
                              ? 'text-xs px-3 py-1 rounded-full bg-charcoal text-cream'
                              : 'text-xs px-3 py-1 rounded-full border border-gold-light text-charcoal'
                          }
                        >
                          {kosherIcon(kt)} {kt}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder="Type to search, e.g. chicken"
                    className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto border border-gold-light/40 rounded-2xl divide-y divide-gold-light/20">
                    {recipesForEditingCourse
                      .filter((r) => recipeTitle(r).toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setPickedRecipeId(r.id)}
                          className={
                            r.id === pickedRecipeId
                              ? 'w-full text-left px-4 py-2.5 bg-gold-light/30 text-charcoal font-medium text-sm'
                              : 'w-full text-left px-4 py-2.5 text-charcoal text-sm hover:bg-gold-light/10'
                          }
                        >
                          {recipeTitle(r)}
                        </button>
                      ))}
                    {recipesForEditingCourse
                      .filter((r) => recipeTitle(r).toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter).length === 0 && (
                      <p className="px-4 py-3 text-sm text-charcoal/40">
                        No match — try Quick entry instead, or add one from the Recipes page.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-charcoal/50 mb-3">
                  No {tCourse(editing.course).toLowerCase()} recipes saved yet — add one from the Recipes page, or
                  use a quick entry.
                </p>
              )
            ) : (
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Type what you're planning"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-3"
                autoFocus
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2.5 rounded-full border border-charcoal/30 text-charcoal"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                disabled={saving || (pickerMode === 'custom' && !customName.trim())}
                className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  days,
  data,
  hebcal,
  fastDays,
  recipeTitle,
  t,
  onDayClick,
}: {
  days: Date[];
  data: Record<string, DayData>;
  hebcal: Record<string, HebcalDay>;
  fastDays: Record<string, FastDay>;
  recipeTitle: (r: Recipe) => string;
  t: ReturnType<typeof useTranslations>;
  onDayClick: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const date = fmt(d);
        const day = data[date];
        const fastDay = fastDays[date];
        const hasMajorFastConflict = fastDay?.severity === 'major' && (day?.entries.length ?? 0) > 0;
        const hcal = hebcal[date];
        return (
          <button
            key={date}
            onClick={() => onDayClick(date)}
            className={`relative min-h-[90px] rounded-lg border p-1.5 text-[10px] text-left hover:border-gold transition-colors ${
              hcal?.isFast ? 'border-gold-light/40 bg-cream/60 text-charcoal/50' : 'border-gold-light/40 bg-white'
            }`}
          >
            {hcal?.isYomTov && (
              <div className="absolute inset-x-0 top-0 rounded-t-lg bg-gold-light/40 px-1 py-0.5 text-center text-[8px] font-medium text-charcoal">
                {t('yomTov')}
              </div>
            )}
            <div className={`flex items-center justify-between ${hcal?.isYomTov ? 'mt-4' : ''}`}>
              <span className="font-medium">{d.getDate()}</span>
              {hcal?.isErevShabbos && <Flame className="h-3 w-3 text-gold-dark" />}
              {day?.hasMeatDairyBuffer && (
                <span title={t('sameDayWarning')} className="h-2 w-2 rounded-full bg-gold" />
              )}
              {getPrepWarning(day?.entries ?? [], hcal?.candleLighting) && (
                <span title="Recorded prep time for this day may not finish before candle-lighting">
                  <AlertTriangle className="h-3 w-3 text-rust" />
                </span>
              )}
              {hasMajorFastConflict && (
                <span title={fastDay!.note}>
                  <AlertTriangle className="h-3 w-3 text-white bg-rust rounded-full p-0.5" />
                </span>
              )}
            </div>
            {hcal?.isFast && <p className="text-[8px]">{t('fast')}</p>}
            {fastDay?.severity === 'major' && (
              <p className="text-[8px] font-semibold text-rust" title={fastDay.note}>
                {fastDay.holiday_name}
              </p>
            )}
            {fastDay?.severity === 'minor' && (
              <p className="text-[8px] text-charcoal/50" title={fastDay.note}>
                {fastDay.holiday_name} (fast)
              </p>
            )}
            {hcal?.hebrewDate && (
              <p className="text-[8px] text-charcoal/40" lang="he" dir="rtl">
                {hcal.hebrewDate}
              </p>
            )}
            <div className="mt-1 space-y-0.5">
              {(day?.entries ?? []).slice(0, 4).map((e) =>
                e.recipes ? (
                  <p key={e.id} className="line-clamp-1">
                    {recipeTitle(e.recipes)}
                  </p>
                ) : null
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
