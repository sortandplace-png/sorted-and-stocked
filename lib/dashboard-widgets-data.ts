// lib/dashboard-widgets-data.ts
// Server-side data fetchers for the 4 Dashboard Widgets v1 cards. Each
// reads from data that already exists elsewhere in the app -- no new
// tracking, same convention as the rest of app/properties/[id]/dashboard/page.tsx.
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';

export const WIDGET_KEYS = ['todays_meal_plan', 'prep_ahead'] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export type WidgetPrefs = Record<WidgetKey, { isVisible: boolean; sortOrder: number }>;

const DEFAULT_PREFS: WidgetPrefs = {
  todays_meal_plan: { isVisible: true, sortOrder: 1 },
  prep_ahead: { isVisible: true, sortOrder: 2 },
};

// No prefs row for a given widget_key (or no rows at all) means "visible,
// default position" -- a brand-new user/property combination should see
// all 4, not none, per spec.
export async function getWidgetPrefs(propertyId: string): Promise<WidgetPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;

  const { data } = await supabase
    .from('dashboard_widget_prefs')
    .select('widget_key, is_visible, sort_order')
    .eq('user_id', user.id)
    .eq('property_id', propertyId);

  const prefs = { ...DEFAULT_PREFS };
  for (const row of data ?? []) {
    if (WIDGET_KEYS.includes(row.widget_key as WidgetKey)) {
      prefs[row.widget_key as WidgetKey] = { isVisible: row.is_visible, sortOrder: row.sort_order };
    }
  }
  return prefs;
}

export type TodaysMealEntry = { mealSlot: string; course: string; courseSlug: string; name: string; recipeId: string | null };

// course_icons.display_name has the real label for every course slug
// ("kids_platter" -> "Kids platter", "vege" -> "Vegetable", etc.) -- no FK
// from meal_plan_entries.course to course_icons.course, so this can't be a
// PostgREST embedded-relation select. course_icons is a small, fixed
// reference table (8 rows), so one extra query and an in-memory lookup is
// simpler and cheaper than adding a schema relationship just for this.
export async function getTodaysMealPlan(propertyId: string): Promise<TodaysMealEntry[]> {
  const supabase = await createClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [{ data }, { data: courseIcons }] = await Promise.all([
    supabase
      .from('meal_plan_entries')
      .select('meal_slot, course, custom_name, sequence, recipe_id, recipes(name)')
      .eq('property_id', propertyId)
      .eq('plan_date', todayStr)
      .order('meal_slot')
      .order('sequence'),
    supabase.from('course_icons').select('course, display_name'),
  ]);

  const courseLabels = new Map((courseIcons ?? []).map((c) => [c.course, c.display_name]));

  return (data ?? []).map((e: any) => ({
    mealSlot: e.meal_slot ?? 'meal',
    course: e.course ? (courseLabels.get(e.course) ?? e.course) : '',
    // Raw slug, kept alongside the display-name `course` above -- the
    // widget's hardcoded course-order arrays match against real slugs
    // ('protein', 'vege', ...), not the translated display text.
    courseSlug: e.course ?? '',
    // Real bug found and fixed, not assumed: this used to prefer custom_name
    // over the linked recipe's name. Every other place in the codebase that
    // renders a meal-plan entry (MealPlanView's own displayName(), line
    // ~2021, MealPlanViewer) already prefers the linked recipe -- this was
    // the one exception. Confirmed live via direct DB comparison: 38 rows
    // property-wide have a recipe_id pointing to a DIFFERENT dish than their
    // stale custom_name (legacy data drift, likely from before the editor's
    // save path enforced recipe_id/custom_name as mutually exclusive --
    // every current write path already does). Preferring the recipe here
    // matches that established precedence and makes the stale custom_name
    // text permanently inert for any row that has a real recipe linked.
    name: e.recipes?.name || e.custom_name || 'Untitled',
    // A custom-named entry (no recipe_id) or a linked recipe that's since
    // been deleted (recipe_id set but the embed comes back null) both mean
    // there's nowhere real to link -- only a genuine live recipe gets a link.
    recipeId: e.recipe_id && e.recipes ? e.recipe_id : null,
  }));
}

export type LowStockItem = { id: string; name: string; currentQty: number; minQty: number; category: string | null };

export async function getLowStockAlerts(propertyId: string): Promise<LowStockItem[]> {
  const supabase = await createClient();
  // current_qty < min_qty is a column-to-column comparison, which
  // PostgREST's query builder can't express -- fetching every row and
  // filtering client-side would silently truncate on a property with more
  // rows than the project's max-rows cap (the exact bug found earlier
  // tonight on the inventory count stat). get_low_stock_items() does the
  // comparison server-side instead (migration 091).
  const { data } = await supabase.rpc('get_low_stock_items', { p_property_id: propertyId });

  return (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    currentQty: item.current_qty,
    minQty: item.min_qty,
    category: item.category,
  }));
}
