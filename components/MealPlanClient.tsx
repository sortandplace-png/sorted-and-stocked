// components/MealPlanClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Course = 'soup' | 'protein' | 'starch' | 'vege' | 'salad' | 'dessert' | 'kids_platter';

const COURSES: { key: Course; label: string; icon: string }[] = [
  { key: 'soup', label: 'Soup', icon: '🥣' },
  { key: 'protein', label: 'Protein', icon: '🍗' },
  { key: 'starch', label: 'Starch', icon: '🍚' },
  { key: 'vege', label: 'Vege', icon: '🥦' },
  { key: 'salad', label: 'Salad', icon: '🥗' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
  { key: 'kids_platter', label: 'Kids Platter', icon: '🍎' },
];

type Recipe = {
  id: string;
  name: string;
  servings: number;
  course: Course | null;
  kosher_type: string | null;
};

type PlanEntry = {
  id: string;
  plan_date: string;
  course: Course;
  recipe_id: string | null;
  custom_name: string | null;
  recipes: { name: string; photo_url: string | null } | null;
};

type IngredientRow = { name: string; quantity: string; unit: string; category: string };

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A day's visual identity in the weekly grid. Fast days and Yom Tov take
// priority over the regular Friday-night / Shabbos-day coloring, so the most
// significant thing about the day is what reads first.
type DayTheme = {
  label: string;
  emoji: string;
  strip: string; // colored top bar on the card
  header: string; // header background
  text: string; // header text color
  special: boolean; // festive meal → gets a dessert course
};

function dayTheme(i: number, isFast: boolean, isYomTov: boolean): DayTheme {
  if (isFast)
    return { label: DAY_FULL[i], emoji: '🕯️', strip: 'bg-rust', header: 'bg-rust/10', text: 'text-rust', special: false };
  if (isYomTov)
    return { label: 'Yom Tov', emoji: '✡︎', strip: 'bg-aubergine', header: 'bg-aubergine', text: 'text-cream', special: true };
  if (i === 5)
    return { label: 'Friday Night', emoji: '🌙', strip: 'bg-indigo-800', header: 'bg-indigo-50', text: 'text-indigo-900', special: true };
  if (i === 6)
    return { label: 'Shabbos Day', emoji: '✨', strip: 'bg-gold', header: 'bg-gold-light/50', text: 'text-aubergine', special: true };
  return { label: DAY_FULL[i], emoji: '', strip: 'bg-gold-light', header: 'bg-gold-light/15', text: 'text-aubergine', special: false };
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MealPlanClient({ propertyId }: { propertyId: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushingToShopping, setPushingToShopping] = useState(false);
  // Jewish calendar (Hebcal) — holidays/fasts/Yom Tov for the visible week.
  const [holidays, setHolidays] = useState<
    Record<string, { title: string; category: string; yomtov: boolean }[]>
  >({});

  const [editing, setEditing] = useState<{ date: string; course: Course } | null>(null);
  const [pickerMode, setPickerMode] = useState<'existing' | 'custom'>('existing');
  const [pickedRecipeId, setPickedRecipeId] = useState('');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [kosherFilter, setKosherFilter] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);

  const [showNewRecipe, setShowNewRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeServings, setNewRecipeServings] = useState('4');
  const [newRecipeCourse, setNewRecipeCourse] = useState<Course>('protein');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { name: '', quantity: '', unit: '', category: '' },
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const supabase = createClient();
  const showToast = useToast();

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [entriesRes, recipesRes] = await Promise.all([
      supabase
        .from('meal_plan_entries')
        .select('id, plan_date, course, recipe_id, custom_name, recipes(name, photo_url)')
        .eq('property_id', propertyId)
        .gte('plan_date', toDateStr(weekStart))
        .lte('plan_date', toDateStr(weekEnd)),
      supabase.from('recipes').select('id, name, servings, course, kosher_type').eq('property_id', propertyId).order('name'),
    ]);

    if (entriesRes.error) setError(entriesRes.error.message);
    setEntries((entriesRes.data as unknown as PlanEntry[]) ?? []);
    setRecipes(recipesRes.data ?? []);
    setLoading(false);
  }, [propertyId, supabase, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch Jewish-calendar events for the visible week from Hebcal (public API,
  // no key). Only the date range is sent — no user data. Silent on failure so
  // the meal plan still works offline.
  useEffect(() => {
    const start = toDateStr(weekStart);
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const end = toDateStr(endDate);
    const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&mf=on&ss=on&nx=on&start=${start}&end=${end}`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data: { items?: { title: string; date: string; category: string; yomtov?: boolean }[] }) => {
        if (cancelled) return;
        const map: Record<string, { title: string; category: string; yomtov: boolean }[]> = {};
        for (const item of data.items ?? []) {
          const d = (item.date ?? '').slice(0, 10);
          if (!d) continue;
          if (!map[d]) map[d] = [];
          map[d].push({ title: item.title, category: item.category, yomtov: !!item.yomtov });
        }
        setHolidays(map);
      })
      .catch(() => setHolidays({}));
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  function entryFor(dateStr: string, course: Course) {
    return entries.find((e) => e.plan_date === dateStr && e.course === course) ?? null;
  }

  function displayName(entry: PlanEntry | null) {
    if (!entry) return null;
    return entry.recipes?.name ?? entry.custom_name;
  }

  function openPicker(dateStr: string, course: Course) {
    const recipesForCourse = recipes.filter((r) => r.course === course);
    setEditing({ date: dateStr, course });
    setPickerMode(recipesForCourse.length > 0 ? 'existing' : 'custom');
    setPickedRecipeId(recipesForCourse[0]?.id ?? '');
    setCustomName('');
    setRecipeSearch('');
    setKosherFilter(null);
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
    loadData();
  }

  async function clearEntry(dateStr: string, course: Course) {
    const existing = entryFor(dateStr, course);
    if (!existing) return;
    await resilientDelete(supabase, 'meal_plan_entries', { id: existing.id });
    setEntries((prev) => prev.filter((e) => e.id !== existing.id));
  }

  function addIngredientRow() {
    setIngredientRows((prev) => [...prev, { name: '', quantity: '', unit: '', category: '' }]);
  }

  function updateIngredientRow(index: number, field: keyof IngredientRow, value: string) {
    setIngredientRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveNewRecipe() {
    if (!newRecipeName.trim()) return;
    setSavingRecipe(true);

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        property_id: propertyId,
        name: newRecipeName.trim(),
        servings: Number(newRecipeServings) || 4,
        course: newRecipeCourse,
      })
      .select('id')
      .single();

    if (recipeError || !recipe) {
      setSavingRecipe(false);
      showToast('Failed to save recipe.', { variant: 'error' });
      return;
    }

    const validRows = ingredientRows.filter((r) => r.name.trim());
    if (validRows.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        validRows.map((r) => ({
          recipe_id: recipe.id,
          name: r.name.trim(),
          quantity: r.quantity ? Number(r.quantity) : null,
          unit: r.unit.trim() || null,
          category: r.category.trim() || null,
        }))
      );
    }

    setSavingRecipe(false);
    setShowNewRecipe(false);
    setNewRecipeName('');
    setNewRecipeServings('4');
    setNewRecipeCourse('protein');
    setIngredientRows([{ name: '', quantity: '', unit: '', category: '' }]);
    showToast('Recipe saved.', { variant: 'success' });
    loadData();
  }

  async function addWeekToShoppingList() {
    setPushingToShopping(true);
    setError(null);

    const recipeIds = entries.map((e) => e.recipe_id).filter((id): id is string => !!id);
    if (recipeIds.length === 0) {
      setPushingToShopping(false);
      showToast('No linked recipes this week — nothing to add. (Custom text entries have no ingredient list.)');
      return;
    }

    const { data: ingredients, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select('name, quantity, unit, category')
      .in('recipe_id', recipeIds);

    if (ingredientsError || !ingredients) {
      setPushingToShopping(false);
      showToast('Failed to load ingredients.', { variant: 'error' });
      return;
    }

    let { data: list } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!list) {
      const { data: created, error: createError } = await supabase
        .from('shopping_lists')
        .insert({ property_id: propertyId, name: 'Shopping List', status: 'active' })
        .select('id')
        .single();
      if (createError || !created) {
        setPushingToShopping(false);
        showToast('Failed to create shopping list.', { variant: 'error' });
        return;
      }
      list = created;
    }

    const rows = ingredients.map((ing) => ({
      shopping_list_id: list!.id,
      name: ing.quantity ? `${ing.name} (${ing.quantity}${ing.unit ? ' ' + ing.unit : ''})` : ing.name,
      category: ing.category,
      qty_needed: 1,
      status: 'pending' as const,
    }));

    const { error: insertError } = await supabase.from('shopping_list_items').insert(rows);
    setPushingToShopping(false);

    if (insertError) {
      showToast('Failed to add ingredients.', { variant: 'error' });
      return;
    }

    showToast(`Added ${rows.length} ingredient${rows.length === 1 ? '' : 's'} to Shopping.`, {
      variant: 'success',
    });
  }

  if (loading) return <SkeletonList rows={2} />;

  const recipesForEditingCourse = editing ? recipes.filter((r) => r.course === editing.course) : [];

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-1 print:hidden">
        <h1 className="text-2xl font-display text-aubergine">Meal plan</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => window.print()} className="text-sm font-medium text-aubergine">
            🖨️ Print
          </button>
          <button
            onClick={() => setShowNewRecipe(true)}
            className="text-sm font-medium text-aubergine underline"
          >
            + New recipe
          </button>
        </div>
      </div>
      <div className="hidden print:block mb-3">
        <h1 className="font-display text-2xl text-aubergine">Meal Plan</h1>
        <p className="text-sm text-ink/50">
          {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
          {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
          className="text-aubergine text-sm"
        >
          ← Prev
        </button>
        <span className="text-xs text-ink/50">
          {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
          {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <button
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          className="text-aubergine text-sm"
        >
          Next →
        </button>
      </div>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px] text-ink/50 print:hidden">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-800 inline-block" /> Friday Night
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-gold inline-block" /> Shabbos Day
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-aubergine inline-block" /> Yom Tov
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rust inline-block" /> Fast day
        </span>
      </div>

      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 mb-5">
        {weekDates.map((d, i) => {
          const dateStr = toDateStr(d);
          const isToday = toDateStr(new Date()) === dateStr;
          const isShabbos = i === 5 || i === 6;
          const dayHolidays = holidays[dateStr] ?? [];
          const isFast = dayHolidays.some((h) => h.category === 'fast');
          const isYomTov = dayHolidays.some((h) => h.yomtov);
          const theme = dayTheme(i, isFast, isYomTov);
          const onDark = theme.text === 'text-cream';
          // Dessert shows on festive meals (Shabbos + Yom Tov).
          const isFestive = theme.special || isShabbos;
          return (
            <div
              key={dateStr}
              className={
                'rounded-2xl bg-white shadow-sm shadow-aubergine/5 overflow-hidden' +
                (isToday ? ' ring-2 ring-gold' : '')
              }
            >
              <div className={'h-1.5 ' + theme.strip} />
              <div className={'flex items-center gap-2 px-4 py-2 ' + theme.header}>
                <span className={'text-xs font-semibold ' + theme.text}>
                  {theme.emoji && <span className="mr-1">{theme.emoji}</span>}
                  {theme.label}
                </span>
                <span className={'text-xs ' + (onDark ? 'text-cream/70' : 'text-ink/50')}>
                  {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {dayHolidays.length > 0 && (
                  <span
                    className={
                      'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[55%] ' +
                      (isFast
                        ? 'text-rust bg-rust/15'
                        : onDark
                        ? 'text-aubergine bg-cream'
                        : 'text-aubergine bg-gold-light/60')
                    }
                    title={dayHolidays.map((h) => h.title).join(' · ')}
                  >
                    {dayHolidays.map((h) => h.title).join(' · ')}
                  </span>
                )}
              </div>
              <div className="divide-y divide-gold-light/20">
                {COURSES.filter(({ key }) => key !== 'dessert' || isFestive).map(({ key, label, icon }) => {
                  const entry = entryFor(dateStr, key);
                  const name = displayName(entry);
                  const photo = entry?.recipes?.photo_url;
                  const linkedRecipeId = entry?.recipe_id;
                  return (
                    <div key={key} className="flex items-center gap-2.5 px-4 py-2">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-gold-light/25 shrink-0 flex items-center justify-center text-base">
                          {icon}
                        </span>
                      )}
                      <span className="text-[11px] text-ink/40 w-14 shrink-0">{label}</span>
                      {linkedRecipeId ? (
                        <Link
                          href={`/properties/${propertyId}/recipes/${linkedRecipeId}`}
                          className="flex-1 min-w-0 text-sm text-ink truncate underline decoration-gold-light decoration-2 underline-offset-2"
                        >
                          {name}
                        </Link>
                      ) : (
                        <button
                          onClick={() => openPicker(dateStr, key)}
                          className="flex-1 text-left min-w-0 text-sm"
                        >
                          {name ? (
                            <span className="text-ink truncate block">{name}</span>
                          ) : (
                            <span className="text-ink/25">+ add</span>
                          )}
                        </button>
                      )}
                      {linkedRecipeId && (
                        <button
                          onClick={() => openPicker(dateStr, key)}
                          className="text-ink/30 text-xs shrink-0"
                          aria-label="Change"
                        >
                          ✏️
                        </button>
                      )}
                      {entry && (
                        <button
                          onClick={() => clearEntry(dateStr, key)}
                          className="text-rust text-xs shrink-0"
                        >
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

      <div className="print:hidden">
        <button
          onClick={addWeekToShoppingList}
          disabled={pushingToShopping}
          className="w-full py-3 rounded-full bg-aubergine text-cream font-medium disabled:opacity-40"
        >
          {pushingToShopping ? 'Adding…' : "Add this week's ingredients to Shopping"}
        </button>
        <Link
          href={`/properties/${propertyId}/shopping-list`}
          className="block text-center text-sm font-medium text-aubergine underline mt-3"
        >
          Go to shopping list →
        </Link>
        <p className="text-xs text-ink/40 text-center mt-2">
          Only courses linked to a saved recipe (not typed-in text) have ingredients to add.
        </p>
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
            <h2 className="font-display text-xl text-aubergine mb-1">
              {COURSES.find((c) => c.key === editing.course)?.icon}{' '}
              {COURSES.find((c) => c.key === editing.course)?.label}
            </h2>
            <p className="text-xs text-ink/40 mb-3">
              {new Date(editing.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>

            {editing.course === 'kids_platter' && (
              <div className="mb-3">
                <p className="text-xs text-ink/50 mb-2">
                  Kids Platter was never really a recipe list — it's always been 3 fixed combos. Tap one, or use Quick entry for something else.
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    'Platter A — carrots, apples, grapes',
                    'Platter B — berries, cheese cubes',
                    'Platter C — melon, crackers',
                    'Platter D — cucumbers, pretzels, hummus',
                    'Platter E — clementines, string cheese, crackers',
                    'Platter F — cherry tomatoes, pita, olives',
                    'Platter G — apple slices, peanut butter, raisins',
                    'Platter H — grapes, cheese sticks, mini muffins',
                  ].map((platter) => (
                    <button
                      key={platter}
                      onClick={() => {
                        setPickerMode('custom');
                        setCustomName(platter);
                      }}
                      className={
                        customName === platter && pickerMode === 'custom'
                          ? 'text-left px-4 py-2.5 rounded-2xl bg-gold-light/30 text-aubergine font-medium text-sm border border-gold'
                          : 'text-left px-4 py-2.5 rounded-2xl bg-cream/60 text-ink text-sm border border-gold-light/40'
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
                    ? 'flex-1 py-2 rounded-full bg-aubergine text-cream text-sm'
                    : 'flex-1 py-2 rounded-full border border-aubergine/30 text-aubergine text-sm'
                }
              >
                Pick a recipe
              </button>
              <button
                onClick={() => setPickerMode('custom')}
                className={
                  pickerMode === 'custom'
                    ? 'flex-1 py-2 rounded-full bg-aubergine text-cream text-sm'
                    : 'flex-1 py-2 rounded-full border border-aubergine/30 text-aubergine text-sm'
                }
              >
                Quick entry
              </button>
            </div>

            {pickerMode === 'existing' ? (
              recipesForEditingCourse.length > 0 ? (
                <div className="mb-3">
                  {[...new Set(recipesForEditingCourse.map((r) => r.kosher_type).filter(Boolean))]
                    .length > 0 && (
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {[...new Set(recipesForEditingCourse.map((r) => r.kosher_type).filter(Boolean))].map(
                        (kt) => (
                          <button
                            key={kt}
                            onClick={() => setKosherFilter(kosherFilter === kt ? null : kt)}
                            className={
                              kosherFilter === kt
                                ? 'text-xs px-3 py-1 rounded-full bg-aubergine text-cream'
                                : 'text-xs px-3 py-1 rounded-full border border-gold-light text-aubergine'
                            }
                          >
                            {kt}
                          </button>
                        )
                      )}
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
                      .filter((r) => r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setPickedRecipeId(r.id)}
                          className={
                            r.id === pickedRecipeId
                              ? 'w-full text-left px-4 py-2.5 bg-gold-light/30 text-aubergine font-medium text-sm'
                              : 'w-full text-left px-4 py-2.5 text-ink text-sm hover:bg-gold-light/10'
                          }
                        >
                          {r.name}
                        </button>
                      ))}
                    {recipesForEditingCourse
                      .filter((r) => r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                      .filter((r) => !kosherFilter || r.kosher_type === kosherFilter).length === 0 && (
                      <p className="px-4 py-3 text-sm text-ink/40">
                        No match — try Quick entry instead, or add a new recipe.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink/50 mb-3">
                  No {COURSES.find((c) => c.key === editing.course)?.label.toLowerCase()} recipes saved yet —
                  add one with "+ New recipe," or use a quick entry.
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
                className="flex-1 py-2.5 rounded-full border border-aubergine/30 text-aubergine"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                disabled={saving || (pickerMode === 'custom' && !customName.trim())}
                className="flex-1 py-2.5 rounded-full bg-aubergine text-cream disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewRecipe && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setShowNewRecipe(false)}
        >
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-aubergine mb-3">New recipe</h2>

            <div className="space-y-3 mb-3">
              <input
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                placeholder="Recipe name"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
                autoFocus
              />
              <select
                value={newRecipeCourse}
                onChange={(e) => setNewRecipeCourse(e.target.value as Course)}
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              >
                {COURSES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newRecipeServings}
                onChange={(e) => setNewRecipeServings(e.target.value)}
                placeholder="Servings"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              />
            </div>

            <p className="text-sm font-medium text-aubergine mb-2">Ingredients</p>
            <div className="space-y-2 mb-2">
              {ingredientRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateIngredientRow(i, 'name', e.target.value)}
                    placeholder="Ingredient"
                    className="w-2/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
                  />
                  <input
                    value={row.quantity}
                    onChange={(e) => updateIngredientRow(i, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
                  />
                  <input
                    value={row.unit}
                    onChange={(e) => updateIngredientRow(i, 'unit', e.target.value)}
                    placeholder="Unit"
                    className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
                  />
                  <input
                    value={row.category}
                    onChange={(e) => updateIngredientRow(i, 'category', e.target.value)}
                    placeholder="Aisle"
                    className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
                  />
                </div>
              ))}
            </div>
            <button onClick={addIngredientRow} className="text-sm text-aubergine underline mb-4">
              + Add ingredient
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => setShowNewRecipe(false)}
                className="flex-1 py-2.5 rounded-full border border-aubergine/30 text-aubergine"
              >
                Cancel
              </button>
              <button
                onClick={saveNewRecipe}
                disabled={savingRecipe || !newRecipeName.trim()}
                className="flex-1 py-2.5 rounded-full bg-aubergine text-cream disabled:opacity-40"
              >
                {savingRecipe ? 'Saving…' : 'Save recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
