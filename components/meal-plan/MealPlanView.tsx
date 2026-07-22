'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Printer, Flame, AlertTriangle } from 'lucide-react';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import Pin from '@/components/PinAccent';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { kosherIcon } from '@/lib/icon-maps';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { COURSES, type Course } from '@/lib/course-constants';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { getRecipeIcon } from '@/lib/recipe-icons';
import { getNineDaysWindows, isInNineDays, type DateWindow } from '@/lib/nine-days';

// Shared by extendMealPlan's pool filter, repeatWeekForward's copy-skip
// check, and the manual-add warning -- one definition of "meat"/"dairy"
// instead of three.
const isMeat = (kt: string | null | undefined) => kt === 'Meat';
const isDairy = (kt: string | null | undefined) => kt === 'Dairy';

// Same kashrut color tokens as the dashboard's KASHRUT_INFO (Fleishig/
// Milchig/Parve) -- reused here keyed by the real recipes.kosher_type
// values instead of the dashboard's name-guessing heuristic, since Month
// view has the actual field.
const KOSHER_DOT_COLOR: Record<string, string> = {
  Meat: 'bg-rust',
  Dairy: 'bg-dairy',
  Parve: 'bg-sage',
};

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
  sequence: number;
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

// Each combo is now backed by a real `recipes` row (course = kids_platter,
// name = recipeName) with its own recipe_ingredients — see MealPlanPage's
// query. recipeName is used to look up that row in the `recipes` prop at
// click time; label is just the display text.
const KIDS_PLATTERS = [
  { recipeName: 'Platter A', label: 'Platter A — carrots, apples, grapes' },
  { recipeName: 'Platter B', label: 'Platter B — berries, orange segments, cucumber slices' },
  { recipeName: 'Platter C', label: 'Platter C — melon, cucumber, grapes' },
  { recipeName: 'Platter D', label: 'Platter D — cucumbers, carrots, cherry tomatoes' },
  { recipeName: 'Platter E', label: 'Platter E — clementines, grapes, bell pepper strips' },
  { recipeName: 'Platter F', label: 'Platter F — cherry tomatoes, cucumber, bell peppers' },
  { recipeName: 'Platter G', label: 'Platter G — apple slices, orange slices, grapes' },
  { recipeName: 'Platter H', label: 'Platter H — grapes, strawberries, cucumber' },
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

// Real bug found and fixed, not assumed: this used toISOString(), which is
// ALWAYS UTC regardless of the caller's own timezone -- and every Date this
// gets called on (weekDates entries, `anchor`, `new Date()`) is built by
// copying `anchor` (useState(new Date()), the real current moment, whatever
// time-of-day the page happened to load at) and only ever adjusting the day
// via setDate(). The time-of-day is never normalized to midnight, so on any
// evening at or after 8pm Eastern (EDT, UTC-4), that moment has already
// crossed into the next UTC calendar day -- toISOString() then returns
// TOMORROW's date for what's still today locally. Confirmed live: this is
// exactly why the weekly view's Thursday card was showing Friday's candle-
// lighting and Friday's card was showing Saturday's Havdalah -- every
// dateStr used to look up hebcal[dateStr]/days[dateStr] was silently
// shifted one day ahead of the correctly-local-computed day label sitting
// right next to it (DAY_LABELS[i] and toLocaleDateString(), both already
// local-timezone-correct). Fixed by reading the Date object's own local
// year/month/day getters instead -- the same local timezone weekRange()/
// monthRange() already used to BUILD these dates in the first place, so
// this now matches its own inputs instead of silently converting through UTC.
function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Local-date arithmetic on a 'YYYY-MM-DD' string, same local-getter
// approach as fmt() itself -- new Date(dateStr) parses as UTC and can
// land on the wrong calendar day depending on timezone, the exact bug
// class the systematic date-anchoring audit found and fixed elsewhere.
function shiftDate(dateStr: string, deltaDays: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  next.setDate(next.getDate() + deltaDays);
  return fmt(next);
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

  // Day Drawer — the single day-interaction surface for both Week and Month
  // views (Week's per-course rows stay inline and untouched; the drawer
  // adds Duplicate/Print/per-dish move-or-remove/Add Course in one place
  // reachable from either view without navigating away).
  const [dayDrawerOpen, setDayDrawerOpen] = useState<string | null>(null);
  const [drawerDuplicateOpen, setDrawerDuplicateOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [dishMenuOpen, setDishMenuOpen] = useState<string | null>(null);
  const [moveDishOpen, setMoveDishOpen] = useState<string | null>(null);
  const [moveTargetDate, setMoveTargetDate] = useState('');
  const [moving, setMoving] = useState(false);
  const [printOnlyDate, setPrintOnlyDate] = useState<string | null>(null);

  // Month view's fast path: tapping one dish opens just that dish, not the
  // full Day Drawer. The full drawer (Add Course, Duplicate Day, etc.) stays
  // reachable via the day cell's empty space / "View full day" link.
  const [quickEditDish, setQuickEditDish] = useState<{ date: string; entry: Entry } | null>(null);

  // entryId is set when editing a specific existing row (a "Change") so
  // saveEntry knows exactly which row to replace -- important now that a
  // course/day can have more than one entry (dip/salad), so "the" entry for
  // a course is no longer well-defined without it. Absent entryId means
  // "add a new row" (either the course's first, or another alongside
  // existing ones for dip/salad).
  const [editing, setEditing] = useState<{ date: string; course: Course; entryId?: string } | null>(null);
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
  const [nineDaysWindows, setNineDaysWindows] = useState<DateWindow[]>([]);
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<Set<string>>(new Set());
  // Live is_recipe_eligible_for_date() warnings -- only computed for entries
  // actually saved this session (checking every entry in a full month view
  // up front would mean dozens of extra DB calls for rows nobody's looking
  // at). Not persisted; a fresh page load won't show a flag on an entry
  // saved in an earlier session, same honest limitation as any other
  // client-only derived state in this app. Keyed by date+course+sequence,
  // not entry id -- the real id doesn't exist yet at the point this is set
  // (right before the insert that creates it).
  const [entryWarnings, setEntryWarnings] = useState<Record<string, string[]>>({});
  const entryWarningKey = (date: string, course: string, sequence: number) => `${date}::${course}::${sequence}`;

  const range = viewMode === 'week' ? weekRange(anchor) : monthRange(anchor);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    const start = fmt(range.start);
    const end = fmt(range.end);

    const { data: entries, error: fetchError } = await supabase
      .from('meal_plan_entries')
      .select(
        'id, plan_date, meal_slot, course, custom_name, recipe_id, sequence, recipes(id, name, name_es, photo_url, kosher_type, is_shabbos_only, approx_total_minutes)'
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

  // SS-063/145: additive to the SS-149 blackout above, not a replacement --
  // the fast day itself keeps its existing full blackout untouched. Erev
  // gets a Seudah Hamafsekes reminder as that day's final entry; Motzei
  // gets a Break-Fast reminder as its first. Applied uniformly to all six
  // fasts per Racquel's explicit choice (2026-07-21), not split by fast
  // length. Purely derived from fastDays -- no extra fetch, no new Course
  // enum value or recipe-picker slot, just a labeled reminder matching the
  // visual weight the blackout banner itself already uses.
  const erevOf = useMemo(() => {
    const map: Record<string, FastDay> = {};
    for (const [date, fastDay] of Object.entries(fastDays)) {
      map[shiftDate(date, -1)] = fastDay;
    }
    return map;
  }, [fastDays]);

  const motzeiOf = useMemo(() => {
    const map: Record<string, FastDay> = {};
    for (const [date, fastDay] of Object.entries(fastDays)) {
      map[shiftDate(date, 1)] = fastDay;
    }
    return map;
  }, [fastDays]);

  // Reference windows, not property-scoped -- fetched once, same pattern as
  // fastDays above. Current + next Gregorian year comfortably covers both
  // manual adds and the largest real extend/repeat range this UI offers.
  useEffect(() => {
    const thisYear = new Date().getFullYear();
    getNineDaysWindows([thisYear, thisYear + 1]).then(setNineDaysWindows);
  }, []);

  // 3i: recipe favorites feeding into extendMealPlan's rotation pick, same
  // per-person convention as RecipesGridView's own favorites fetch.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('recipe_favorites')
        .select('recipe_id')
        .eq('property_id', propertyId)
        .eq('user_id', user.id);
      setFavoriteRecipeIds(new Set((data ?? []).map((f) => f.recipe_id)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Print Day sets a CSS-only "hide every other day" scope before invoking
  // the browser print dialog, then clears it once the dialog closes —
  // window.print() itself doesn't return a promise, so onafterprint is the
  // only reliable signal that printing is done (or was cancelled).
  useEffect(() => {
    const handler = () => setPrintOnlyDate(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  function printDay(dateStr: string) {
    setPrintOnlyDate(dateStr);
    requestAnimationFrame(() => window.print());
  }

  // Print Day reuses the Week-view card's own print:hidden scoping, so the
  // day must actually be rendered as a Week-view card first — if the drawer
  // was opened from Month view, switch view + wait a couple of frames for
  // that card to mount before invoking the print dialog.
  function printDayFromDrawer(dateStr: string) {
    const needsViewSwitch = viewMode === 'month';
    if (needsViewSwitch) {
      setAnchor(new Date(dateStr + 'T12:00:00'));
      setViewMode('week');
    }
    closeDayDrawer();
    if (needsViewSwitch) {
      requestAnimationFrame(() => requestAnimationFrame(() => printDay(dateStr)));
    } else {
      printDay(dateStr);
    }
  }

  function openDayDrawer(dateStr: string) {
    setDayDrawerOpen(dateStr);
    setDrawerDuplicateOpen(false);
    setDishMenuOpen(null);
    setMoveDishOpen(null);
  }

  function closeDayDrawer() {
    setDayDrawerOpen(null);
    setDrawerDuplicateOpen(false);
    setDishMenuOpen(null);
    setMoveDishOpen(null);
  }

  // Insert at the target date first, only remove the original entry once
  // that succeeds — a same-course conflict on the target date fails the
  // insert and the original stays put, instead of losing data.
  async function moveDish(entry: Entry, targetDate: string) {
    if (!targetDate || targetDate === entry.plan_date) return;
    setMoving(true);
    const payload = entry.recipe_id
      ? {
          property_id: propertyId,
          plan_date: targetDate,
          course: entry.course,
          recipe_id: entry.recipe_id,
          meal_slot: entry.meal_slot,
        }
      : {
          property_id: propertyId,
          plan_date: targetDate,
          course: entry.course,
          custom_name: entry.custom_name,
          meal_slot: entry.meal_slot,
        };
    const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
    if (!result.ok) {
      setMoving(false);
      showToast(`Couldn't move — ${targetDate} already has a ${tCourse(entry.course)} planned.`, {
        variant: 'error',
      });
      return;
    }
    await resilientDelete(supabase, 'meal_plan_entries', { id: entry.id });
    setMoving(false);
    setMoveDishOpen(null);
    setMoveTargetDate('');
    showToast(`Moved to ${targetDate}.`, { variant: 'success' });
    loadEntries();
  }

  async function duplicateDay(sourceDate: string, targetDate: string) {
    if (!targetDate || targetDate === sourceDate) return;
    setDuplicating(true);
    const sourceEntries = days[sourceDate]?.entries ?? [];
    const targetEntries = days[targetDate]?.entries ?? [];
    // Track the next free sequence per course on the target date so copying
    // a source day with 2 dips doesn't insert both at the default sequence
    // (1) and collide with each other, or with anything already on the
    // target date for that course.
    const seqByCourse: Record<string, number> = {};
    for (const e of targetEntries) {
      seqByCourse[e.course] = Math.max(seqByCourse[e.course] ?? 0, e.sequence);
    }
    let inserted = 0;
    for (const entry of sourceEntries) {
      const sequence = (seqByCourse[entry.course] ?? 0) + 1;
      seqByCourse[entry.course] = sequence;
      const payload = entry.recipe_id
        ? {
            property_id: propertyId,
            plan_date: targetDate,
            course: entry.course,
            recipe_id: entry.recipe_id,
            meal_slot: entry.meal_slot,
            sequence,
          }
        : {
            property_id: propertyId,
            plan_date: targetDate,
            course: entry.course,
            custom_name: entry.custom_name,
            meal_slot: entry.meal_slot,
            sequence,
          };
      const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
      if (result.ok) inserted++;
    }
    setDuplicating(false);
    setDrawerDuplicateOpen(false);
    setDuplicateTarget('');
    showToast(
      inserted > 0
        ? `Duplicated ${inserted} meal${inserted === 1 ? '' : 's'} to ${targetDate}.`
        : `Nothing duplicated — ${targetDate} already has all those courses planned.`,
      { variant: inserted > 0 ? 'success' : 'error' }
    );
    loadEntries();
  }

  function recipeTitle(r: Recipe) {
    return locale === 'es' && r.name_es ? r.name_es : r.name;
  }

  // All entries for a course/day, not just one -- dip and salad can now
  // legitimately have more than one row per day (real schema change, see
  // migration 061). Sorted by id as a stable tiebreaker since insertion
  // order isn't otherwise tracked.
  function entriesFor(dateStr: string, course: Course) {
    return (days[dateStr]?.entries ?? [])
      .filter((e) => e.course === course)
      .sort((a, b) => a.sequence - b.sequence);
  }

  function entryFor(dateStr: string, course: Course) {
    return entriesFor(dateStr, course)[0] ?? null;
  }

  function displayName(entry: Entry | null) {
    if (!entry) return null;
    return entry.recipes ? recipeTitle(entry.recipes) : entry.custom_name;
  }

  // SS-148: same wa.me text-share pattern ShoppingListViewEnhanced.tsx
  // already uses for the shopping list, applied to a day/week of meals --
  // Racquel needs to send a plan to staff, not just what to buy. No
  // meal_slot headers: this page's own week/month rendering doesn't split
  // by meal_slot either (course order alone), so the share text matches
  // what's actually on screen rather than inventing a distinction the UI
  // doesn't show.
  function dayShareLines(dateStr: string): string[] {
    const lines: string[] = [];
    for (const course of COURSES) {
      for (const entry of entriesFor(dateStr, course.key)) {
        const name = displayName(entry);
        if (name) lines.push(`${course.label}: ${name}`);
      }
    }
    return lines;
  }

  function shareDayWhatsApp(dateStr: string) {
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const lines = dayShareLines(dateStr);
    const text =
      `*Meal Plan — ${label}*\n` + (lines.length > 0 ? lines.join('\n') : 'Nothing planned.');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function shareWeekWhatsApp() {
    const weekOf = weekDates[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    let text = `*Meal Plan — Week of ${weekOf}*\n`;
    weekDates.forEach((d, i) => {
      const dateStr = fmt(d);
      const lines = dayShareLines(dateStr);
      if (lines.length === 0) return;
      text += `\n*${DAY_LABELS[i]}, ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}*\n${lines.join('\n')}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function openPicker(dateStr: string, course: Course, isSwap = false, targetEntry?: Entry) {
    if (!canEdit) return;
    const recipesForCourse = recipes.filter((r) => r.course === course);
    // targetEntry (a specific row's "Change") takes precedence; falling
    // back to entryFor keeps single-entry courses working exactly as
    // before when called without one.
    const existing = targetEntry ?? (isSwap ? entryFor(dateStr, course) : null);
    setEditing({ date: dateStr, course, entryId: existing?.id });
    if (existing?.recipe_id) {
      setPickerMode('existing');
      setPickedRecipeId(existing.recipe_id);
      setCustomName('');
    } else if (existing?.custom_name) {
      setPickerMode('custom');
      setPickedRecipeId(recipesForCourse[0]?.id ?? '');
      setCustomName(existing.custom_name);
    } else {
      setPickerMode(recipesForCourse.length > 0 ? 'existing' : 'custom');
      setPickedRecipeId(recipesForCourse[0]?.id ?? '');
      setCustomName('');
    }
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

    // Hard stop, not a suggestion -- is_recipe_eligible_for_date() is the
    // real, authoritative halachic/inventory eligibility check (kosher-type
    // buffers, Nine Days, Pesach clearance, etc.), checked here before any
    // write happens. blocking_reasons means the assignment is refused
    // outright; warnings alone (e.g. most inventory pesach_status is still
    // 'needs_review', so this is common right now) still save, just flagged
    // on the card below once the row's real sequence is known.
    let pendingWarnings: string[] = [];
    if (pickerMode === 'existing' && pickedRecipeId) {
      const { data: eligibility, error: eligibilityError } = (await supabase
        .rpc('is_recipe_eligible_for_date', {
          p_recipe_id: pickedRecipeId,
          p_date: editing.date,
          p_property_id: propertyId,
        })
        .maybeSingle()) as {
        data: { eligible: boolean; blocking_reasons: string[]; warnings: string[] } | null;
        error: { message: string } | null;
      };

      if (!eligibilityError && eligibility && eligibility.blocking_reasons?.length > 0) {
        setSaving(false);
        showToast(eligibility.blocking_reasons.join(' '), { variant: 'error', durationMs: 8000 });
        return;
      }
      if (!eligibilityError && eligibility && eligibility.warnings?.length > 0) {
        pendingWarnings = eligibility.warnings;
        showToast(eligibility.warnings.join(' '), { variant: 'default', durationMs: 6000 });
      }
    }

    // Only delete the specific row being replaced (a real "Change") --
    // deleting "the first entry for this course" would be wrong now that
    // dip/salad can have more than one row; adding a new one (no entryId)
    // must never touch any existing row for that course.
    //
    // sequence must be computed explicitly, not left to the column's
    // default (1) -- every insert would otherwise collide with the first
    // dip/salad row's sequence=1 under the real unique constraint
    // (property_id, plan_date, meal_slot, course, sequence), silently
    // failing to insert a genuine 2nd entry (caught live while verifying
    // this feature: a "2nd dip" add produced 0 new rows).
    const existingEntries = entriesFor(editing.date, editing.course);
    const editingEntry = editing.entryId ? existingEntries.find((e) => e.id === editing.entryId) : null;
    const sequence = editingEntry
      ? editingEntry.sequence
      : existingEntries.length > 0
      ? Math.max(...existingEntries.map((e) => e.sequence)) + 1
      : 1;

    const warningKey = entryWarningKey(editing.date, editing.course, sequence);
    setEntryWarnings((prev) => {
      const next = { ...prev };
      if (pendingWarnings.length > 0) next[warningKey] = pendingWarnings;
      else delete next[warningKey];
      return next;
    });

    if (editing.entryId) {
      await resilientDelete(supabase, 'meal_plan_entries', { id: editing.entryId });
    }

    const payload =
      pickerMode === 'existing' && pickedRecipeId
        ? {
            property_id: propertyId,
            plan_date: editing.date,
            course: editing.course,
            recipe_id: pickedRecipeId,
            meal_slot: 'dinner',
            sequence,
          }
        : {
            property_id: propertyId,
            plan_date: editing.date,
            course: editing.course,
            custom_name: customName.trim(),
            meal_slot: 'dinner',
            sequence,
          };

    const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }

    if (result.queued) {
      // Offline — a fresh loadEntries() would hit the network, come back
      // without the not-yet-synced row, and make the entry that was "just
      // saved" appear to vanish. Update local state instead; the real
      // fetch happens next time loadEntries() runs online.
      const optimisticEntry: Entry = {
        id: `pending-${crypto.randomUUID()}`,
        plan_date: editing.date,
        meal_slot: 'dinner',
        course: editing.course,
        recipe_id: pickerMode === 'existing' && pickedRecipeId ? pickedRecipeId : null,
        custom_name: pickerMode === 'custom' ? customName.trim() : null,
        recipes:
          pickerMode === 'existing' && pickedRecipeId
            ? recipes.find((r) => r.id === pickedRecipeId) ?? null
            : null,
        sequence,
      };
      setDays((prev) => {
        const day = prev[editing.date] ?? { date: editing.date, entries: [], hasMeatDairyBuffer: false };
        // Replace only the specific row being changed; adding a new one
        // (no entryId) must keep every existing row for the course intact.
        const entries = [
          ...day.entries.filter((e) => (editing.entryId ? e.id !== editing.entryId : true)),
          optimisticEntry,
        ];
        return { ...prev, [editing.date]: { ...day, entries } };
      });
      setEditing(null);
      return;
    }

    setEditing(null);
    loadEntries();
  }

  async function clearEntry(dateStr: string, course: Course, entryId?: string) {
    const target = entryId ? { id: entryId } : entryFor(dateStr, course);
    if (!target) return;
    await resilientDelete(supabase, 'meal_plan_entries', { id: target.id });
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

    // Same recipe planned more than once this week (e.g. Chicken Soup on
    // both Tuesday and Friday) needs its ingredients counted that many
    // times — .in() below only fetches each ingredient row once regardless
    // of how many times its recipe_id repeats in the array.
    const recipeCounts: Record<string, number> = {};
    for (const id of recipeIds) recipeCounts[id] = (recipeCounts[id] ?? 0) + 1;

    const { data: ingredients, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select('name, quantity, unit, category, recipe_id')
      .in('recipe_id', [...new Set(recipeIds)]);

    if (ingredientsError || !ingredients) {
      setPushingToShopping(false);
      showToast('Failed to load ingredients.', { variant: 'error' });
      return;
    }

    const scaledIngredients = ingredients.map((ing) => ({
      ...ing,
      quantity: ing.quantity !== null ? ing.quantity * (recipeCounts[ing.recipe_id] ?? 1) : ing.quantity,
    }));

    const result = await addIngredientsToShoppingList(supabase, propertyId, scaledIngredients);
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

    // Kids Platter/dip/dessert re-roll from the pool instead of cloning
    // verbatim (every other course still clones as-is). A verbatim copy let
    // a single "stuck" historical pick (e.g. Grapes) propagate forward
    // indefinitely, since repeat-forward was the only path in the app that
    // never consulted least-recently-used. Needs the real recipe-use
    // history to rotate correctly -- same pagination as extendMealPlan,
    // since this table is past PostgREST's 1000-row cap for this property.
    const ROTATION_ELIGIBLE_COURSES: Course[] = ['kids_platter', 'dip', 'dessert'];
    const lastUsedMap = new Map<string, string>();
    {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('meal_plan_entries')
          .select('plan_date, recipe_id')
          .eq('property_id', propertyId)
          .range(from, from + PAGE - 1);
        if (pageError || !page) break;
        for (const e of page) {
          if (!e.recipe_id) continue;
          const prev = lastUsedMap.get(e.recipe_id);
          if (!prev || e.plan_date > prev) lastUsedMap.set(e.recipe_id, e.plan_date);
        }
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    // Tracks the next free sequence per (date, course) within this run so
    // copying a source day with 2 dips doesn't insert both at the default
    // sequence (1) and collide with each other.
    const seqByDateCourse: Record<string, number> = {};
    let inserted = 0;
    for (const entry of thisWeekEntries) {
      const dayOffset = Math.round(
        (new Date(entry.plan_date).getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newDate = new Date(nextWeekStart);
      newDate.setDate(newDate.getDate() + dayOffset);
      const newDateStr = fmt(newDate);
      const newDow = newDate.getDay();

      if (existingKeys.has(`${newDateStr}:${entry.course}`)) continue;
      // Standing rule: Kids Platter never appears Fri/Sat/Sun.
      if (entry.course === 'kids_platter' && (newDow === 0 || newDow === 5 || newDow === 6)) continue;

      const isShabbosDay = newDow === 5 || newDow === 6;
      const rotationEligible = !!entry.recipe_id && ROTATION_ELIGIBLE_COURSES.includes(entry.course);

      let recipeId: string | null = entry.recipe_id;
      if (rotationEligible) {
        const pool = recipes.filter((r) => {
          if (r.course !== entry.course) return false;
          if (r.is_shabbos_only && !isShabbosDay) return false;
          // Nine Days: no meat on a non-Shabbos date inside 1-9 Av.
          if (isMeat(r.kosher_type) && !isShabbosDay && isInNineDays(newDateStr, nineDaysWindows)) return false;
          return true;
        });
        const picked = pickLeastRecentlyUsed(pool, lastUsedMap, newDateStr, favoriteRecipeIds);
        // No eligible replacement (e.g. every candidate is meat inside the
        // Nine Days) -- leave a real gap rather than cloning a pick that
        // might violate the rule the pool was just filtered for.
        if (!picked) continue;
        recipeId = picked.id;
      } else if (!isShabbosDay && isInNineDays(newDateStr, nineDaysWindows) && isMeat(entry.recipes?.kosher_type)) {
        // Nine Days: non-rotation courses still clone recipe_id verbatim,
        // so a meat entry landing on a non-Shabbos date in the window gets
        // skipped here instead of filtered out beforehand -- leaves a real
        // gap rather than copying it through.
        continue;
      }

      const seqKey = `${newDateStr}:${entry.course}`;
      const sequence = (seqByDateCourse[seqKey] ?? 0) + 1;
      seqByDateCourse[seqKey] = sequence;

      const payload = recipeId
        ? {
            property_id: propertyId,
            plan_date: newDateStr,
            course: entry.course,
            recipe_id: recipeId,
            meal_slot: entry.meal_slot,
            sequence,
          }
        : {
            property_id: propertyId,
            plan_date: newDateStr,
            course: entry.course,
            custom_name: entry.custom_name,
            meal_slot: entry.meal_slot,
            sequence,
          };

      const result = await resilientInsert(supabase, 'meal_plan_entries', payload);
      if (result.ok) inserted++;
    }

    setRepeatingWeek(false);
    showToast(`Copied ${inserted} meal${inserted === 1 ? '' : 's'} to next week.`, { variant: 'success' });
    loadEntries();
  }

  // Picks the least-recently-used candidate (never-used sorts first via a
  // sentinel date), then immediately records it as used so the next pick
  // for the same course within this run doesn't repeat it. Favorites (3i)
  // only break a real tie on last-used date -- most commonly several
  // never-used candidates at once -- rather than unconditionally beating
  // every non-favorite regardless of recency. An unconditional favorite-first
  // rule was tried and rejected: it would let 2-3 favorited recipes
  // permanently dominate a course's rotation, defeating the actual point of
  // LRU (variety), not just biasing it.
  function pickLeastRecentlyUsed(
    candidates: Recipe[],
    lastUsedMap: Map<string, string>,
    planDate: string,
    favoriteIds: Set<string> = new Set()
  ) {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => {
      const da = lastUsedMap.get(a.id) ?? '0000-00-00';
      const db = lastUsedMap.get(b.id) ?? '0000-00-00';
      if (da !== db) return da < db ? -1 : 1;
      const aFav = favoriteIds.has(a.id);
      const bFav = favoriteIds.has(b.id);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return 0;
    });
    const picked = sorted[0];
    lastUsedMap.set(picked.id, planDate);
    return picked;
  }

  // Extends past wherever the plan currently ends — not tied to whatever
  // week is on screen. Reuses the last populated week's *structure* (which
  // dates get which courses/meal_slots) but selects a fresh recipe per slot
  // via least-recently-used rotation, rather than repeating the exact same
  // recipes verbatim — otherwise "extend" just cloned one week on a loop.
  // Same skip-if-already-planned rule as repeatWeekForward (resilientInsert
  // no-ops on a conflicting row).
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

    // Least-recently-used needs the recipe's real full history, not just the
    // template week — and this table now has 2000+ rows for this property,
    // past PostgREST's hard 1000-row-per-request cap, so a plain select
    // silently truncates. Real pagination.
    const history: { plan_date: string; recipe_id: string | null }[] = [];
    {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('meal_plan_entries')
          .select('plan_date, recipe_id')
          .eq('property_id', propertyId)
          .range(from, from + PAGE - 1);
        if (pageError || !page) break;
        history.push(...page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    const lastUsedMap = new Map<string, string>();
    for (const e of history) {
      if (!e.recipe_id) continue;
      const prev = lastUsedMap.get(e.recipe_id);
      if (!prev || e.plan_date > prev) lastUsedMap.set(e.recipe_id, e.plan_date);
    }

    const recipeById = new Map(recipes.map((r) => [r.id, r]));

    // Protein first so it sets the day's meat/dairy character before the
    // rest of that day's courses are picked (protein skews heavily Meat).
    const orderedTemplate = [...templateEntries].sort((a, b) =>
      a.course === 'protein' ? -1 : b.course === 'protein' ? 1 : 0
    );

    // Tracks the next free sequence per (date, course) across the whole
    // extend run so a template day with 2 dips doesn't insert both copies
    // at the default sequence (1) and collide with each other.
    const seqByDateCourse: Record<string, number> = {};
    let inserted = 0;
    for (let w = 1; w <= weeks; w++) {
      // Reset per week so each generated week gets its own fresh meat/dairy
      // read per day rather than carrying state across different dates.
      const dayType = new Map<string, { meat: boolean; dairy: boolean }>();

      for (const entry of orderedTemplate) {
        const dayOffset = Math.round(
          (new Date(entry.plan_date).getTime() - templateWeek.start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const newDate = new Date(templateWeek.start);
        newDate.setDate(newDate.getDate() + 7 * w + dayOffset);
        const newDateStr = fmt(newDate);
        const newDow = newDate.getDay();
        const isShabbos = newDow === 5 || newDow === 6;

        // SS-149: extend/repeat runs weeks forward with no per-day review at
        // creation time, so this is the one write path that could silently
        // land real meal rows on a future fast day (fixed Hebrew date, not
        // weekly-periodic, so a template week's offset drifts onto one
        // eventually) without ever showing "+ add" being pressed. Same
        // table/lookup already used for the Nine Days meat check just below.
        if (fastDays[newDateStr]) continue;

        // Standing rule: Kids Platter never appears Fri/Sat/Sun (confirmed
        // live, existing rows on those days were removed in the same pass
        // that added this check) — skip it here rather than let the
        // template silently keep it clean by coincidence.
        if (entry.course === 'kids_platter' && (newDow === 0 || newDow === 5 || newDow === 6)) {
          continue;
        }

        const seqKey = `${newDateStr}:${entry.course}`;
        const sequence = (seqByDateCourse[seqKey] ?? 0) + 1;
        seqByDateCourse[seqKey] = sequence;

        if (!entry.recipe_id) {
          // No recipe to rotate — carry the manual custom entry forward as-is.
          const result = await resilientInsert(supabase, 'meal_plan_entries', {
            property_id: propertyId,
            plan_date: newDateStr,
            course: entry.course,
            custom_name: entry.custom_name,
            meal_slot: entry.meal_slot,
            sequence,
          });
          if (result.ok) inserted++;
          continue;
        }

        const type = dayType.get(newDateStr) ?? { meat: false, dairy: false };
        const templateRecipe = recipeById.get(entry.recipe_id);
        const pool = recipes.filter((r) => {
          if (r.course !== entry.course) return false;
          if (r.is_shabbos_only && !isShabbos) return false;
          if (type.meat && isDairy(r.kosher_type)) return false;
          if (type.dairy && isMeat(r.kosher_type)) return false;
          // Nine Days: no meat on a non-Shabbos date inside 1-9 Av.
          if (isMeat(r.kosher_type) && !isShabbos && isInNineDays(newDateStr, nineDaysWindows)) return false;
          return true;
        });
        const picked = pickLeastRecentlyUsed(pool, lastUsedMap, newDateStr, favoriteRecipeIds) ?? templateRecipe ?? null;
        if (!picked) continue;

        if (isMeat(picked.kosher_type)) type.meat = true;
        if (isDairy(picked.kosher_type)) type.dairy = true;
        dayType.set(newDateStr, type);

        const result = await resilientInsert(supabase, 'meal_plan_entries', {
          property_id: propertyId,
          plan_date: newDateStr,
          course: entry.course,
          recipe_id: picked.id,
          meal_slot: entry.meal_slot,
          sequence,
        });
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

  // Manual-add Nine Days warning -- non-blocking (per the standing pattern
  // for minhag-level cautions in this app, e.g. Rosh Hashana nuts), shown
  // only in 'existing' picker mode with a real Meat recipe selected.
  const pickedRecipe = pickerMode === 'existing' ? recipes.find((r) => r.id === pickedRecipeId) : null;
  const editingIsShabbos = editing
    ? [5, 6].includes(new Date(editing.date + 'T00:00:00Z').getUTCDay())
    : false;
  const showNineDaysWarning =
    !!editing &&
    !editingIsShabbos &&
    isMeat(pickedRecipe?.kosher_type) &&
    isInNineDays(editing.date, nineDaysWindows);

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
        <h1 className="font-display text-2xl text-denim">
          {viewMode === 'week' ? 'Meal Plan' : 'Meal Plan — ' + anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h1>
        {viewMode === 'week' && (
          <p className="text-sm text-dusk">
            {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {error && (
        <p className="print:hidden text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-cardBorder bg-card p-0.5 text-sm">
          <button
            onClick={() => setViewMode('week')}
            className={`rounded-full px-4 py-1.5 ${viewMode === 'week' ? 'bg-denim text-white' : 'text-dusk'}`}
          >
            {t('week')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`rounded-full px-4 py-1.5 ${viewMode === 'month' ? 'bg-denim text-white' : 'text-dusk'}`}
          >
            {t('month')}
          </button>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full bg-card border border-cardBorder px-3 py-1.5 text-xs font-medium text-denim shadow-card hover:bg-mist"
          >
            <Printer className="h-3.5 w-3.5" />
            {viewMode === 'week' ? t('printWeek') : t('printMonth')}
          </button>
          {viewMode === 'week' && (
            <button
              onClick={shareWeekWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-full bg-card border border-cardBorder px-3 py-1.5 text-xs font-medium text-denim shadow-card hover:bg-mist"
            >
              <WhatsAppIcon size={14} />
              Share week
            </button>
          )}
          {canEdit && viewMode === 'week' && (
            <button
              onClick={repeatWeekForward}
              disabled={repeatingWeek}
              title="Copy this week's meals to next week (won't overwrite anything already planned)"
              className="rounded-full bg-card border border-cardBorder px-3 py-1.5 text-xs font-medium text-denim shadow-card hover:bg-mist disabled:opacity-40"
            >
              {repeatingWeek ? '…' : 'Repeat next week →'}
            </button>
          )}
          {canEdit && viewMode === 'week' && (
            <button
              onClick={generateShoppingList}
              disabled={pushingToShopping}
              className="rounded-full bg-denim px-4 py-2 text-xs font-medium text-white hover:bg-denim/90 disabled:opacity-40"
            >
              {pushingToShopping ? '…' : t('generateShoppingList')}
            </button>
          )}
          {canEdit && viewMode === 'week' && (
            <button
              onClick={() => extendMealPlan(4)}
              disabled={extending}
              title="Repeat the last planned week forward 4 more weeks, wherever the plan currently ends"
              className="rounded-full bg-card border border-cardBorder px-3 py-1.5 text-xs font-medium text-denim shadow-card hover:bg-mist disabled:opacity-40"
            >
              {extending ? '…' : 'Extend plan +4 weeks'}
            </button>
          )}
        </div>
      </div>

      {canEdit && viewMode === 'week' && (
        <div className="print:hidden -mt-2 mb-4 flex items-center justify-between flex-wrap gap-1">
          <p className="text-xs text-dusk">
            Only courses linked to a saved recipe (not typed-in text) have ingredients to add.
          </p>
          {justGeneratedList && (
            <Link
              href={`/properties/${propertyId}/shopping-list`}
              className="text-xs font-medium text-denim underline"
            >
              Go to shopping list →
            </Link>
          )}
        </div>
      )}

      {viewMode === 'week' ? (
        <>
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 mb-5">
          {weekDates.map((d, i) => {
            const dateStr = fmt(d);
            const isToday = fmt(new Date()) === dateStr;
            const isShabbos = i === 5 || i === 6;
            const isWeekendOrSunday = i === 0 || i === 5 || i === 6;
            const hcal = hebcal[dateStr];
            const day = days[dateStr];
            const fastDay = fastDays[dateStr];
            // SS-149: blackout applies to the fast day's own date only --
            // fastDays is keyed one row per fast day, so Erev Tisha B'Av/
            // Erev Yom Kippur and the day after (motzei-fast/break-fast)
            // simply have no entry here and are untouched, same as every
            // other ordinary day. The pre-existing Nine Days meat
            // restriction (isInNineDays below) is a separate, already-
            // correct mechanism and is left alone -- it already permits
            // non-meat planning on Erev Tisha B'Av, which is what "stays
            // fully plannable" requires there.
            const isFastDayBlackout = !!fastDay;
            const erevInfo = erevOf[dateStr];
            const motzeiInfo = motzeiOf[dateStr];

            return (
              <div
                key={dateStr}
                className={
                  'relative rounded-xl2 bg-card border border-cardBorder shadow-card overflow-hidden' +
                  (isToday ? ' ring-2 ring-brass' : '') +
                  (printOnlyDate === dateStr ? '' : ' print:hidden')
                }
              >
                <div className="relative flex items-start gap-2 px-4 py-3 bg-denim">
                  <Pin size="sm" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold uppercase text-white">{DAY_LABELS[i]}</span>
                    <span className="text-xs text-white/90">
                      {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {hcal?.isErevShabbos && <Flame className="h-3 w-3 text-brass" />}
                    {day?.hasMeatDairyBuffer && (
                      <span
                        title={t('sameDayWarning')}
                        className="h-2 w-2 rounded-full bg-rust shrink-0"
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
                        className="text-[10px] font-medium text-dusk bg-mist px-2 py-0.5 rounded-full shrink-0"
                      >
                        {fastDay.holiday_name}
                      </span>
                    )}
                    {hcal && hcal.titles.length > 0 ? (
                      <span
                        className={
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[60%] ' +
                          (hcal.isFast
                            ? 'text-rust bg-rust/10'
                            : hcal.isYomTov
                            ? 'text-white bg-denim'
                            : 'text-denim bg-mist')
                        }
                        title={hcal.titles.join(' · ')}
                      >
                        ✡︎ {hcal.isFast ? 'Fast: ' : ''}
                        {hcal.titles.join(' · ')}
                      </span>
                    ) : isShabbos ? (
                      <span className="text-[10px] font-semibold text-denim bg-mist px-2 py-0.5 rounded-full">
                        ✨ Shabbos
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => openDayDrawer(dateStr)}
                    className="print:hidden text-[11px] font-medium text-white/90 ml-auto mr-4 shrink-0 whitespace-nowrap"
                  >
                    Day options →
                  </button>
                </div>
                {isFastDayBlackout ? (
                  <div className="flex items-start gap-2 px-4 py-3 bg-rust/10 border border-rust/30">
                    <AlertTriangle className="h-4 w-4 text-rust shrink-0 mt-0.5" />
                    <p className="text-[11px] text-rust font-semibold tracking-wide">
                      {fastDay!.holiday_name}: {fastDay!.note || 'No meals planned -- fast day.'}
                    </p>
                  </div>
                ) : (
                <>
                {motzeiInfo && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brass/10 border-b border-cardBorder">
                    <span className="text-base shrink-0" aria-hidden>🕯️</span>
                    <p className="text-xs text-denim font-medium">
                      Break-Fast — {motzeiInfo.holiday_name} ended
                    </p>
                  </div>
                )}
                <div>
                  {COURSES.filter(
                    ({ key }) =>
                      (key !== 'dessert' || isShabbos || entriesFor(dateStr, key).length > 0) &&
                      (key !== 'dip' || isShabbos || entriesFor(dateStr, key).length > 0) &&
                      // Standing rule: Kids Platter never appears Fri/Sat/Sun
                      // — same "hide the row, don't just leave it empty"
                      // treatment dip already gets, not a new pattern.
                      (key !== 'kids_platter' || !isWeekendOrSunday || entriesFor(dateStr, key).length > 0)
                  ).flatMap(({ key, label, icon }) => {
                    const entries = entriesFor(dateStr, key);
                    // Multi-entry courses (dip/salad) can have several real
                    // rows a day now (migration 061) -- one row per entry,
                    // never collapsed into "the" entry for the course.
                    const rows = entries.length > 0 ? entries : [null];
                    const canAddAnother = (key === 'dip' || key === 'salad') && entries.length > 0;
                    return [
                      ...rows.map((entry, idx) => {
                        const name = displayName(entry);
                        const photo = entry?.recipes?.photo_url;
                        const linkedRecipeId = entry?.recipe_id;
                        return (
                          <div key={`${key}-${entry?.id ?? 'empty'}`} className="relative flex items-center gap-2.5 mx-3 my-1.5 px-3 py-2.5 rounded-xl2 bg-mist">
                            <Pin size="sm" />
                            {photo && isDirectImageUrl(photo) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <span className="w-12 h-12 rounded-lg bg-card shrink-0 flex items-center justify-center text-lg">
                                {icon}
                              </span>
                            )}
                            <span className="text-xs text-brass font-semibold uppercase tracking-wider w-14 shrink-0">
                              {tCourse(key)}
                              {rows.length > 1 ? ` ${idx + 1}` : ''}
                            </span>
                            {linkedRecipeId ? (
                              <Link
                                href={`/properties/${propertyId}/recipes/${linkedRecipeId}`}
                                className="flex-1 min-w-0 text-sm text-denim truncate underline decoration-brass decoration-2 underline-offset-2"
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
                                  <span className="text-denim truncate block">{name}</span>
                                ) : (
                                  <span className="text-brass hover:underline">{canEdit ? '+ add' : ''}</span>
                                )}
                              </button>
                            )}
                            {canEdit && linkedRecipeId && (
                              <button
                                onClick={() => openPicker(dateStr, key, true, entry ?? undefined)}
                                className="text-dusk text-xs shrink-0"
                                aria-label="Change"
                              >
                                ✏️
                              </button>
                            )}
                            {canEdit && entry && (
                              <button
                                onClick={() => clearEntry(dateStr, key, entry.id)}
                                className="text-rust text-xs shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      }),
                      canAddAnother && canEdit ? (
                        <div key={`${key}-add-another`} className="px-4 py-1.5">
                          <button
                            onClick={() => openPicker(dateStr, key)}
                            className="text-[11px] text-brass font-medium"
                          >
                            + Add another {tCourse(key)}
                          </button>
                        </div>
                      ) : null,
                    ].filter(Boolean);
                  })}
                </div>
                {erevInfo && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brass/10 border-t border-cardBorder">
                    <span className="text-base shrink-0" aria-hidden>🕯️</span>
                    <p className="text-xs text-denim font-medium">
                      Seudah Hamafsekes — before {erevInfo.holiday_name} begins
                    </p>
                  </div>
                )}
                </>
                )}
              </div>
            );
          })}
        </div>

        {/* Print-only compact week table -- swaps in for the rich photo
            cards above (which get print:hidden via the printOnlyDate check
            in their className, above) whenever a full week prints, so
            5-8 courses x 7 days fits one page instead of two. Print Day
            (printOnlyDate set) keeps using the one rich card that check
            leaves visible instead -- this block doesn't render for that
            case, so it never competes with it. */}
        {!printOnlyDate && (
          <div className="hidden print:block">
            <table className="w-full border-collapse text-[8.5px] leading-[1.25]">
              <tbody>
                {weekDates.flatMap((d, i) => {
                  const dateStr = fmt(d);
                  const isShabbos = i === 5 || i === 6;
                  const isWeekendOrSunday = i === 0 || i === 5 || i === 6;
                  const hcal = hebcal[dateStr];
                  const fastDay = fastDays[dateStr];
                  const isFastDayBlackout = !!fastDay;
                  const erevInfo = erevOf[dateStr];
                  const motzeiInfo = motzeiOf[dateStr];

                  const rows = [
                    <tr key={`${dateStr}-hdr`}>
                      <td colSpan={2} className="border-b border-black pt-1.5 pb-0.5 font-bold text-[9px] text-black">
                        {DAY_LABELS[i]}, {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {hcal?.isErevShabbos ? ' 🕯️' : ''}
                        {hcal && hcal.titles.length > 0 ? (
                          <span className="font-semibold"> — {hcal.isFast ? 'Fast: ' : ''}{hcal.titles.join(' · ')}</span>
                        ) : isShabbos ? (
                          <span className="font-semibold"> — Shabbos</span>
                        ) : null}
                        {fastDay?.severity === 'minor' && (
                          <span className="font-semibold"> — {fastDay.holiday_name}{fastDay.note ? `: ${fastDay.note}` : ''}</span>
                        )}
                      </td>
                    </tr>,
                  ];

                  if (isFastDayBlackout) {
                    rows.push(
                      <tr key={`${dateStr}-blackout`}>
                        <td colSpan={2} className="border border-black px-1.5 py-1 font-semibold text-black">
                          {fastDay!.holiday_name}: {fastDay!.note || 'No meals planned — fast day.'}
                        </td>
                      </tr>
                    );
                    return rows;
                  }

                  if (motzeiInfo) {
                    rows.push(
                      <tr key={`${dateStr}-motzei`}>
                        <td colSpan={2} className="border-b border-dashed border-gray-400 px-0.5 py-0.5 font-medium">
                          🕯️ Break-Fast — {motzeiInfo.holiday_name} ended
                        </td>
                      </tr>
                    );
                  }

                  const visibleCourses = COURSES.filter(
                    ({ key }) =>
                      (key !== 'dessert' || isShabbos || entriesFor(dateStr, key).length > 0) &&
                      (key !== 'dip' || isShabbos || entriesFor(dateStr, key).length > 0) &&
                      (key !== 'kids_platter' || !isWeekendOrSunday || entriesFor(dateStr, key).length > 0)
                  );

                  visibleCourses.forEach(({ key }) => {
                    const entries = entriesFor(dateStr, key);
                    const courseRows = entries.length > 0 ? entries : [null];
                    courseRows.forEach((entry, idx) => {
                      rows.push(
                        <tr key={`${dateStr}-${key}-${entry?.id ?? idx}`} className="border-b border-gray-300">
                          <td className="py-px pr-2 w-24 align-top text-gray-600 whitespace-nowrap">
                            {tCourse(key)}{courseRows.length > 1 ? ` ${idx + 1}` : ''}
                          </td>
                          <td className="py-px">{displayName(entry) || '—'}</td>
                        </tr>
                      );
                    });
                  });

                  if (erevInfo) {
                    rows.push(
                      <tr key={`${dateStr}-erev`}>
                        <td colSpan={2} className="border-t border-dashed border-gray-400 px-0.5 py-0.5 font-medium">
                          🕯️ Seudah Hamafsekes — before {erevInfo.holiday_name} begins
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
      ) : (
        <MonthGrid
          days={monthRange(anchor).days}
          data={days}
          hebcal={hebcal}
          fastDays={fastDays}
          erevOf={erevOf}
          motzeiOf={motzeiOf}
          recipeTitle={recipeTitle}
          t={t}
          onDayClick={(date) => openDayDrawer(date)}
          onDishClick={(date, entry) => setQuickEditDish({ date, entry })}
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
          className="text-sm text-denim underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
        >
          ← Prev
        </button>
        <button onClick={() => setAnchor(new Date())} className="text-sm text-dusk">
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
          className="text-sm text-denim underline"
        >
          Next →
        </button>
      </div>

      {dayDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-end print:hidden"
          onClick={closeDayDrawer}
        >
          <div
            className="bg-linen w-full max-w-sm h-full overflow-y-auto shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-linen border-b border-cardBorder px-5 py-4 flex items-start justify-between z-10">
              <div>
                <h2 className="font-display text-lg text-denim">
                  {new Date(dayDrawerOpen + 'T12:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h2>
                {hebcal[dayDrawerOpen]?.hebrewDate && (
                  <p className="text-xs text-dusk" lang="he" dir="rtl">
                    {hebcal[dayDrawerOpen]!.hebrewDate}
                  </p>
                )}
              </div>
              <button onClick={closeDayDrawer} className="text-dusk text-xl leading-none" aria-label="Close">
                ✕
              </button>
            </div>

            {/* SS-149: same blackout as the week/month grids, but this
                drawer is the actual add/edit surface both of them open into
                -- the real enforcement point, not just a visual echo. */}
            {fastDays[dayDrawerOpen] ? (
              <div className="flex items-start gap-2 px-5 py-4 bg-rust/10 border border-rust/30">
                <AlertTriangle className="h-4 w-4 text-rust shrink-0 mt-0.5" />
                <p className="text-[11px] text-rust font-semibold tracking-wide">
                  {fastDays[dayDrawerOpen]!.holiday_name}: {fastDays[dayDrawerOpen]!.note || 'No meals planned -- fast day.'}
                </p>
              </div>
            ) : (
            <>
            {canEdit && (
              <div className="px-5 py-3 flex items-center gap-4 border-b border-cardBorder">
                <div className="relative">
                  <button
                    onClick={() => setDrawerDuplicateOpen((v) => !v)}
                    className="text-xs font-medium text-brass"
                  >
                    Duplicate Day
                  </button>
                  {drawerDuplicateOpen && (
                    <div className="absolute z-20 top-full left-0 mt-1 w-56 rounded-xl bg-card shadow-cardHover border border-cardBorder p-3 space-y-2">
                      <p className="text-[11px] text-dusk">Copy this day's meals to:</p>
                      <input
                        type="date"
                        value={duplicateTarget}
                        onChange={(e) => setDuplicateTarget(e.target.value)}
                        className="w-full rounded-lg border border-cardBorder px-2 py-1 text-xs text-denim"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setDrawerDuplicateOpen(false)} className="text-[11px] text-dusk">
                          Cancel
                        </button>
                        <button
                          onClick={() => duplicateDay(dayDrawerOpen, duplicateTarget)}
                          disabled={!duplicateTarget || duplicating}
                          className="rounded-full bg-denim px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                        >
                          {duplicating ? '…' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => printDayFromDrawer(dayDrawerOpen)}
                  className="text-xs font-medium text-brass"
                >
                  Print Day
                </button>
                <button
                  onClick={() => shareDayWhatsApp(dayDrawerOpen)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brass"
                >
                  <WhatsAppIcon size={14} /> Share Day
                </button>
              </div>
            )}

            {motzeiOf[dayDrawerOpen] && (
              <div className="flex items-center gap-2 px-5 py-3 bg-brass/10 border-b border-cardBorder">
                <span className="text-base shrink-0" aria-hidden>🕯️</span>
                <p className="text-sm text-denim font-medium">
                  Break-Fast — {motzeiOf[dayDrawerOpen].holiday_name} ended
                </p>
              </div>
            )}

            <div className="divide-y divide-cardBorder bg-card">
              {COURSES.flatMap(({ key }) => {
                const entries = entriesFor(dayDrawerOpen, key);
                const canAddAnother = (key === 'dip' || key === 'salad') && entries.length > 0 && canEdit;
                const rows = entries.map((entry, idx, arr) => {
                const name = displayName(entry);
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 px-5 py-3">
                    <span className="text-base shrink-0" aria-hidden>
                      {kosherIcon(entry.recipes?.kosher_type ?? null)}
                    </span>
                    <span className="text-[11px] text-dusk w-14 shrink-0">
                      {tCourse(key)}
                      {arr.length > 1 ? ` ${idx + 1}` : ''}
                    </span>
                    {entry.recipe_id ? (
                      <Link
                        href={`/properties/${propertyId}/recipes/${entry.recipe_id}`}
                        className="flex-1 min-w-0 text-sm text-denim truncate underline decoration-brass decoration-2 underline-offset-2"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="flex-1 min-w-0 text-sm text-denim truncate">{name}</span>
                    )}
                    {(() => {
                      const warnings = entryWarnings[entryWarningKey(dayDrawerOpen, key, entry.sequence)];
                      if (!warnings || warnings.length === 0) return null;
                      return (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-brass shrink-0"
                          strokeWidth={2}
                          aria-label={warnings.join(' ')}
                        >
                          <title>{warnings.join(' ')}</title>
                        </AlertTriangle>
                      );
                    })()}
                    {canEdit && (
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setDishMenuOpen(dishMenuOpen === entry.id ? null : entry.id)}
                          className="text-dusk text-sm px-1"
                          aria-label="Dish options"
                        >
                          •••
                        </button>
                        {dishMenuOpen === entry.id && (
                          <div
                            className="absolute z-20 top-full right-0 mt-1 w-44 rounded-xl bg-card shadow-cardHover border border-cardBorder py-1"
                            onMouseLeave={() => setDishMenuOpen(null)}
                          >
                            {entry.recipe_id && (
                              <Link
                                href={`/properties/${propertyId}/recipes/${entry.recipe_id}`}
                                onClick={() => setDishMenuOpen(null)}
                                className="block w-full text-left px-3 py-1.5 text-xs text-denim hover:bg-mist"
                              >
                                View recipe
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                setDishMenuOpen(null);
                                openPicker(dayDrawerOpen, key, true, entry);
                              }}
                              className="block w-full text-left px-3 py-1.5 text-xs text-denim hover:bg-mist"
                            >
                              Change
                            </button>
                            <button
                              onClick={() => {
                                setDishMenuOpen(null);
                                setMoveDishOpen(entry.id);
                                setMoveTargetDate('');
                              }}
                              className="block w-full text-left px-3 py-1.5 text-xs text-denim hover:bg-mist"
                            >
                              Move to Another Day
                            </button>
                            <button
                              onClick={() => {
                                setDishMenuOpen(null);
                                clearEntry(dayDrawerOpen, key, entry.id);
                              }}
                              className="block w-full text-left px-3 py-1.5 text-xs text-rust hover:bg-rust/10"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {moveDishOpen === entry.id && (
                          <div className="absolute z-20 top-full right-0 mt-1 w-56 rounded-xl bg-card shadow-cardHover border border-cardBorder p-3 space-y-2">
                            <p className="text-[11px] text-dusk">Move to:</p>
                            <input
                              type="date"
                              value={moveTargetDate}
                              onChange={(e) => setMoveTargetDate(e.target.value)}
                              className="w-full rounded-lg border border-cardBorder px-2 py-1 text-xs text-denim"
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setMoveDishOpen(null)} className="text-[11px] text-dusk">
                                Cancel
                              </button>
                              <button
                                onClick={() => moveDish(entry, moveTargetDate)}
                                disabled={!moveTargetDate || moving}
                                className="rounded-full bg-denim px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                              >
                                {moving ? '…' : 'Move'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                });
                return canAddAnother
                  ? [
                      ...rows,
                      <div key={`${key}-add-another`} className="px-5 py-2">
                        <button
                          onClick={() => openPicker(dayDrawerOpen, key)}
                          className="text-xs text-brass font-medium"
                        >
                          + Add another {tCourse(key)}
                        </button>
                      </div>,
                    ]
                  : rows;
              })}
            </div>

            {canEdit && COURSES.filter(({ key }) => !entryFor(dayDrawerOpen, key)).length > 0 && (
              <div className="px-5 py-4">
                <p className="text-[10px] uppercase tracking-wide text-dusk mb-2">Add course</p>
                <div className="flex flex-wrap gap-2">
                  {COURSES.filter(({ key }) => !entryFor(dayDrawerOpen, key)).map(({ key, icon }) => (
                    <button
                      key={key}
                      onClick={() => openPicker(dayDrawerOpen, key)}
                      className="rounded-full border border-brass px-3 py-1.5 text-xs font-medium text-brass"
                    >
                      {icon} {tCourse(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {erevOf[dayDrawerOpen] && (
              <div className="flex items-center gap-2 px-5 py-3 bg-brass/10 border-t border-cardBorder">
                <span className="text-base shrink-0" aria-hidden>🕯️</span>
                <p className="text-sm text-denim font-medium">
                  Seudah Hamafsekes — before {erevOf[dayDrawerOpen].holiday_name} begins
                </p>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      )}

      {quickEditDish && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setQuickEditDish(null)}
        >
          <div
            className="bg-card rounded-xl3 shadow-card w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {quickEditDish.entry.recipes?.photo_url && (
              <img
                src={quickEditDish.entry.recipes.photo_url}
                alt=""
                className="w-full h-32 object-cover"
              />
            )}
            <div className="p-4">
              <p className="text-[11px] text-dusk">
                {tCourse(quickEditDish.entry.course)} ·{' '}
                {new Date(quickEditDish.date + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              {quickEditDish.entry.recipe_id ? (
                <Link
                  href={`/properties/${propertyId}/recipes/${quickEditDish.entry.recipe_id}`}
                  onClick={() => setQuickEditDish(null)}
                  className="font-display text-lg text-denim mt-0.5 block underline decoration-brass decoration-2 underline-offset-2"
                >
                  {displayName(quickEditDish.entry)}
                </Link>
              ) : (
                <p className="font-display text-lg text-denim mt-0.5">{displayName(quickEditDish.entry)}</p>
              )}

              {canEdit ? (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const { date, entry } = quickEditDish;
                      setQuickEditDish(null);
                      openPicker(date, entry.course, true, entry);
                    }}
                    className="w-full rounded-full bg-denim text-white text-sm font-medium py-2"
                  >
                    Change
                  </button>
                  <button
                    onClick={() => {
                      const { date, entry } = quickEditDish;
                      setQuickEditDish(null);
                      clearEntry(date, entry.course, entry.id);
                    }}
                    className="w-full rounded-full border border-rust/40 text-rust text-sm font-medium py-2"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => {
                      const { date } = quickEditDish;
                      setQuickEditDish(null);
                      openDayDrawer(date);
                    }}
                    className="w-full text-center text-xs text-dusk py-1"
                  >
                    View full day →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const { date } = quickEditDish;
                    setQuickEditDish(null);
                    openDayDrawer(date);
                  }}
                  className="mt-4 w-full text-center text-xs text-dusk py-1"
                >
                  View full day →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card w-full rounded-t-[2rem] sm:rounded-xl3 p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-denim mb-1">
              {COURSES.find((c) => c.key === editing.course)?.icon}{' '}
              {tCourse(editing.course)}
            </h2>
            <p className="text-xs text-dusk mb-3">
              {new Date(editing.date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>

            {showIntentStep ? (
              <div className="space-y-2">
                <p className="text-sm text-dusk mb-1">What's the reason for the swap?</p>
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
                    className="w-full text-left px-4 py-2.5 rounded-2xl bg-linen/60 text-denim text-sm border border-cardBorder hover:border-brass transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setShowIntentStep(false)}
                  className="w-full text-center text-sm text-dusk mt-1 py-1"
                >
                  Show me everything →
                </button>
              </div>
            ) : (
              <>
            {swapIntent && (
              <div className="flex items-center justify-between bg-mist rounded-xl px-3 py-2 mb-3 text-xs text-dusk">
                <span>
                  Filtered for: {
                    { too_much_work: 'Too much work', kids_wont_eat: "Kids won't eat it", quicker: 'Need something quicker', different_protein: 'Different protein' }[swapIntent]
                  }
                </span>
                <button onClick={() => setSwapIntent(null)} className="text-dusk underline">
                  Clear
                </button>
              </div>
            )}

            {editing.course === 'kids_platter' && (
              <div className="mb-3">
                <p className="text-xs text-dusk mb-2">
                  Kids Platter was never really a recipe list — it's always been fixed combos. Tap one, or use
                  Quick entry for something else.
                </p>
                <div className="flex flex-col gap-2">
                  {KIDS_PLATTERS.map((platter) => {
                    const match = recipes.find(
                      (r) => r.course === 'kids_platter' && r.name === platter.recipeName
                    );
                    const isActive = match
                      ? pickerMode === 'existing' && pickedRecipeId === match.id
                      : pickerMode === 'custom' && customName === platter.label;
                    return (
                      <button
                        key={platter.recipeName}
                        onClick={() => {
                          if (match) {
                            setPickerMode('existing');
                            setPickedRecipeId(match.id);
                          } else {
                            // Fallback if the recipe row is missing for some reason —
                            // still lets the slot get filled with the plain text label.
                            setPickerMode('custom');
                            setCustomName(platter.label);
                          }
                        }}
                        className={
                          isActive
                            ? 'text-left px-4 py-2.5 rounded-2xl bg-denim text-white font-semibold text-sm border border-denim'
                            : 'text-left px-4 py-2.5 rounded-2xl bg-linen/60 text-denim text-sm border border-cardBorder'
                        }
                      >
                        {platter.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setPickerMode('existing')}
                className={
                  pickerMode === 'existing'
                    ? 'flex-1 py-2 rounded-full bg-denim text-white text-sm'
                    : 'flex-1 py-2 rounded-full bg-linen border border-brass/30 text-denim text-sm'
                }
              >
                Pick a recipe
              </button>
              <button
                onClick={() => setPickerMode('custom')}
                className={
                  pickerMode === 'custom'
                    ? 'flex-1 py-2 rounded-full bg-denim text-white text-sm'
                    : 'flex-1 py-2 rounded-full bg-linen border border-brass/30 text-denim text-sm'
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
                              ? 'text-xs px-3 py-1 rounded-full bg-denim text-white'
                              : 'text-xs px-3 py-1 rounded-full border border-cardBorder text-denim'
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
                    className="w-full border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen/40 mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto border border-cardBorder rounded-2xl divide-y divide-cardBorder">
                    {recipesForEditingCourse
                      .filter((r) => recipeTitle(r).toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setPickedRecipeId(r.id)}
                          className={
                            r.id === pickedRecipeId
                              ? 'w-full text-left px-4 py-2.5 border-l-2 border-brass bg-mist text-denim font-semibold text-sm'
                              : 'w-full text-left px-4 py-2.5 border-l-2 border-transparent text-denim text-sm hover:bg-mist'
                          }
                        >
                          {recipeTitle(r)}
                        </button>
                      ))}
                    {recipesForEditingCourse
                      .filter((r) => recipeTitle(r).toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter).length === 0 && (
                      <p className="px-4 py-3 text-sm text-dusk">
                        No match — try Quick entry instead, or add one from the Recipes page.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-dusk mb-3">
                  No {tCourse(editing.course).toLowerCase()} recipes saved yet — add one from the Recipes page, or
                  use a quick entry.
                </p>
              )
            ) : (
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Type what you're planning"
                className="w-full border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen/40 mb-3"
                autoFocus
              />
            )}

            {showNineDaysWarning && (
              <div className="flex items-start gap-2 px-3 py-2 mb-3 bg-rust/10 border border-rust/20 rounded-2xl">
                <AlertTriangle className="h-4 w-4 text-rust shrink-0 mt-0.5" />
                <p className="text-xs text-rust font-medium">
                  This falls within the Nine Days (1–9 Av), when many avoid meat except on Shabbos. You can still
                  save this — consult your rav if you're unsure.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                disabled={saving || (pickerMode === 'custom' && !customName.trim())}
                className="flex-1 py-2.5 rounded-full bg-denim text-white disabled:opacity-40"
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
  erevOf,
  motzeiOf,
  recipeTitle,
  t,
  onDayClick,
  onDishClick,
}: {
  days: Date[];
  data: Record<string, DayData>;
  hebcal: Record<string, HebcalDay>;
  fastDays: Record<string, FastDay>;
  erevOf: Record<string, FastDay>;
  motzeiOf: Record<string, FastDay>;
  recipeTitle: (r: Recipe) => string;
  t: ReturnType<typeof useTranslations>;
  onDayClick: (date: string) => void;
  onDishClick: (date: string, entry: Entry) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const date = fmt(d);
        const day = data[date];
        const entries = day?.entries ?? [];
        const fastDay = fastDays[date];
        const hasMajorFastConflict = fastDay?.severity === 'major' && entries.length > 0;
        const erevInfo = erevOf[date];
        const motzeiInfo = motzeiOf[date];
        const hcal = hebcal[date];
        return (
          // A day cell is a plain div (not <button>) so each dish inside can
          // be its own real <button> for tap-to-quick-edit -- nesting
          // <button> inside <button> is invalid HTML and React won't render
          // it correctly. Blank space in the cell still opens the full Day
          // Drawer via this div's own onClick; dish buttons stop propagation
          // so tapping a dish doesn't also trigger that.
          <div
            key={date}
            role="button"
            tabIndex={0}
            onClick={() => onDayClick(date)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onDayClick(date);
            }}
            className={`relative min-h-[124px] rounded-lg border p-2 text-xs text-left hover:border-brass transition-colors cursor-pointer ${
              hcal?.isFast ? 'border-cardBorder bg-linen/60 text-dusk' : 'border-cardBorder bg-card'
            }`}
          >
            <Pin size="sm" />
            {hcal?.isYomTov && (
              <div className="absolute inset-x-0 top-0 rounded-t-lg bg-mist px-1 py-0.5 text-center text-[9px] font-medium text-denim">
                {t('yomTov')}
              </div>
            )}
            <div className={`flex items-start justify-between gap-1 flex-wrap ${hcal?.isYomTov ? 'mt-4' : ''}`}>
              <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-denim text-white text-[10px] font-bold">
                {d.getDate()}
              </span>
              {/* Text labels stay visible at every width, not just on hover/desktop --
                  hover tooltips don't exist on a touch device, which is exactly the
                  case these are meant to cover. pr-4 keeps this row's badges clear of
                  the Pin dot's fixed top-right footprint (top:11 right:12, ~22px) --
                  same collision this session already found and fixed for the week
                  view's "Day options" button. */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end pr-4">
                {hcal?.isErevShabbos && (
                  <span className="flex items-center gap-0.5 text-brass whitespace-nowrap">
                    <Flame className="h-3 w-3 shrink-0" />
                    <span className="text-[9px] font-medium">{t('shabbos')}</span>
                  </span>
                )}
                {day?.hasMeatDairyBuffer && (
                  <span className="flex items-center gap-0.5 whitespace-nowrap" title={t('sameDayWarning')}>
                    <span className="h-2 w-2 rounded-full bg-rust shrink-0" aria-hidden />
                    <span className="text-[9px] font-medium text-brass">{t('mdBuffer')}</span>
                  </span>
                )}
                {getPrepWarning(entries, hcal?.candleLighting) && (
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
            </div>
            {hcal?.isFast && <p className="text-[10px]">{t('fast')}</p>}
            {fastDay?.severity === 'major' && (
              <p className="text-[10px] font-semibold text-rust" title={fastDay.note}>
                {fastDay.holiday_name}
              </p>
            )}
            {fastDay?.severity === 'minor' && (
              <p className="text-[10px] text-dusk" title={fastDay.note}>
                {fastDay.holiday_name} (fast)
              </p>
            )}
            {motzeiInfo && (
              <p className="text-[10px] font-medium text-denim" title={`${motzeiInfo.holiday_name} ended`}>
                🕯️ Break-Fast
              </p>
            )}
            {erevInfo && (
              <p className="text-[10px] font-medium text-denim" title={`Before ${erevInfo.holiday_name} begins`}>
                🕯️ Seudah Hamafsekes
              </p>
            )}
            {hcal?.hebrewDate && (
              <p className="text-[9px] text-dusk" lang="he" dir="rtl">
                {hcal.hebrewDate}
              </p>
            )}
            <div className="mt-1 space-y-1">
              {entries.length === 0 ? (
                <p className="text-[10px] text-dusk italic">
                  {fastDay ? `${fastDay.holiday_name} -- no meals` : t('nothingPlanned')}
                </p>
              ) : (
                <>
                  {entries.slice(0, 5).map((e) => {
                    const kosherType = e.recipes?.kosher_type ?? null;
                    const dotColor = kosherType ? KOSHER_DOT_COLOR[kosherType] : undefined;
                    const DishIcon = getRecipeIcon(e.course);
                    const name = e.recipes ? recipeTitle(e.recipes) : e.custom_name ?? '';
                    if (!name) return null;
                    return (
                      <button
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDishClick(date, e);
                        }}
                        className="flex items-start gap-1 w-full text-left hover:bg-mist rounded px-0.5 -mx-0.5"
                      >
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor ?? 'bg-dusk/30'}`}
                          aria-hidden
                        />
                        {e.recipes?.photo_url ? (
                          <img
                            src={e.recipes.photo_url}
                            alt=""
                            className="h-3.5 w-3.5 rounded-sm object-cover shrink-0 mt-0.5"
                          />
                        ) : (
                          <DishIcon className="h-3 w-3 text-dusk shrink-0 mt-0.5" aria-hidden />
                        )}
                        <span className="line-clamp-2 leading-snug">{name}</span>
                      </button>
                    );
                  })}
                  {entries.length > 5 && (
                    <p className="text-[9px] text-dusk pl-3">+{entries.length - 5} more</p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
