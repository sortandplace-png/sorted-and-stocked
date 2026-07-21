// app/properties/[id]/dashboard/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { format, parseISO } from 'date-fns'
import { Calendar, Camera, Clock, Package, Plus, Scan, ShoppingCart, Square, Circle, Triangle, BookOpen, Flame, UtensilsCrossed } from 'lucide-react'
import FloatingScanButton from '@/components/FloatingScanButton'
import LocationZmanim from '@/components/LocationZmanim'
import DashboardWidgets from '@/components/DashboardWidgets'
import CollapsibleCard from '@/components/CollapsibleCard'
import TodayCandleLightingRow from '@/components/TodayCandleLightingRow'
import { getUpcomingEruvTavshilin } from '@/lib/yom-tov'
import { getWidgetPrefs, getTodaysMealPlan, getLowStockAlerts } from '@/lib/dashboard-widgets-data'
import {
  getOmerStatus,
  getIsErevYomTov,
  getIsFastDayToday,
  getRoshChodeshStatus,
  getMajorHolidayToday,
  getIsNineDays,
  resolveTriggerType,
} from '@/lib/calendar-trigger-type'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Single source of truth for "what is this Date's calendar date in Eastern
// time" -- this file had five separate near-identical spots (getDaysUntilPesach,
// weekBounds, getPrepReminders, getReadinessSummary, the Prep Ahead window)
// each computing "today" via format()/toISOString() with no timezone, which
// silently reads the server runtime's own local time -- Vercel defaults to
// UTC, not Eastern -- so on any Eastern evening at/after 8pm (EDT, UTC-4)
// every one of them was already asking for TOMORROW's date. Found via a
// real audit (grepping every "today"/"now" date computation in this app),
// not fixed one at a time as each was separately noticed. One implementation
// now, not five that could quietly drift apart from each other.
function easternDateStr(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

// Pure calendar-date arithmetic, deliberately not going through a real
// Date-in-a-timezone conversion -- Date.UTC's Y/M/D fields already ARE the
// Eastern calendar date by the time this is called, so anchoring the
// arithmetic to UTC just keeps them from being reinterpreted through any
// timezone at all (setUTCDate handles month/year rollover automatically).
function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() }
}

async function fetchShabbat(y: number | string, m: number | string, d: number | string) {
  const res = await fetch(
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=5100280&M=on&lg=he&gy=${y}&gm=${m}&gd=${d}`,
    { next: { revalidate: 86400 } }
  )
  const data = await res.json()
  return {
    candle: data.items?.find((i: any) => i.category === 'candles'),
    havdalah: data.items?.find((i: any) => i.category === 'havdalah'),
    // Was stripping the English string "Candle lighting: " out of candle.title
    // — but with lg=he, candle.title is Hebrew, so that .replace() was always
    // a silent no-op and this was actually rendering the candle-lighting
    // item's raw Hebrew text as if it were the parsha name. The real parsha
    // name lives on its own item, category === 'parashat' (confirmed live
    // against the real Hebcal response).
    parashat: data.items?.find((i: any) => i.category === 'parashat'),
  }
}

async function getHebcal() {
  // Lakewood, NJ - geonameid 5100280. Candle-lighting/parsha only change
  // once a week and the Hebrew date only once a day — 1h revalidation was
  // needlessly frequent for values this stable, confirmed nothing else on
  // this page depends on sub-day freshness.
  //
  // Real bug found and fixed, not assumed: a dateless /shabbat query
  // returns Hebcal's OWN implicit notion of "today," which doesn't
  // reliably match real wall-clock time -- confirmed live on a Saturday
  // night after Havdalah had already passed, Hebcal's dateless response
  // was still returning the just-finished Shabbos (candle-lighting for
  // the Friday just past) instead of the upcoming one, while the exact
  // same query with an explicit gy/gm/gd for that same moment correctly
  // returned next week's Shabbos. Anchoring to the real Eastern-time date
  // (same Intl.DateTimeFormat technique used everywhere else on this
  // page, not the runtime's own local timezone -- Vercel defaults to UTC)
  // removes the ambiguity Hebcal's own default was introducing. This also
  // means the fetch URL itself now changes once a day, so a stale
  // previous-day response can't linger past its own day's cache entry
  // even before the 24h revalidate window would have expired it.
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())
  const eastMap = Object.fromEntries(eastern.map((p) => [p.type, p.value]))
  try {
    let { candle, havdalah, parashat } = await fetchShabbat(eastMap.year, eastMap.month, eastMap.day)

    // Second real bug, same family as above: gy/gm/gd is a bare Gregorian
    // calendar date with no time-of-day, so the query stays "Saturday" --
    // and Hebcal keeps returning the Shabbos that JUST ended -- for the
    // several hours between real Havdalah and real midnight. The Jewish
    // day has already turned over; the Gregorian calendar date hasn't.
    // Confirmed live: querying gd=<Saturday> at any time on that Saturday
    // returns the identical Friday candle-lighting, whether it's 3pm or
    // 11pm, since the request itself carries no hour. Fixed by comparing
    // real now (a real Date instant) against the returned Havdalah's own
    // ISO timestamp (carries its own UTC offset, safe to compare directly
    // regardless of server timezone) -- once now is past it, the current
    // Shabbos is genuinely over, so re-query one calendar day later. That's
    // always enough: the only way "now > havdalah" can be true while still
    // on the SAME Gregorian day as that havdalah is the Havdalah-to-
    // midnight window, and +1 day always lands past midnight.
    if (havdalah && new Date() > new Date(havdalah.date)) {
      const next = addDays(Number(eastMap.year), Number(eastMap.month), Number(eastMap.day), 1)
      ;({ candle, havdalah, parashat } = await fetchShabbat(next.year, next.month, next.day))
    }

    return {
      // candle.date is a full ISO string with its own -04:00/-05:00 offset
      // (e.g. "2026-07-03T20:11:00-04:00"). Formatting it without an
      // explicit timeZone reads the JS runtime's own timezone instead —
      // Vercel's serverless functions default to UTC, so an 8:11pm Eastern
      // candle lighting (00:11 UTC the next day) rendered as "12:11 AM".
      candleTime: candle
        ? new Date(candle.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
        : '8:12pm',
      candleDate: candle?.date,
      havdalahDate: havdalah?.date,
      parsha: parashat?.hebrew || ''
    }
  } catch {
    return { candleTime: '8:12pm', candleDate: null, havdalahDate: null, parsha: '' }
  }
}

// The /shabbat feed's top-level "date" field is the response-generation
// timestamp, NOT a Hebrew date (confirmed live — it's a raw ISO string) —
// the real Hebrew date + numeric day both come from the date-converter
// endpoint instead, one call doing both jobs.
//
// Real bug found and fixed, not assumed, same family as getHebcal() above:
// format(new Date(), ...) with no timeZone option reads the JS runtime's
// own local time -- Vercel defaults to UTC, not Eastern -- so on any
// Eastern evening at/after 8pm (EDT, UTC-4) this was already asking Hebcal
// for TOMORROW's Hebrew date, showing it a day early on the Today card's
// large Hebrew-date line. Anchored to the real Eastern calendar date.
async function getHebrewInfo(): Promise<{ day: number | null; hebrewText: string }> {
  try {
    const today = easternDateStr(new Date())
    const res = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${today}&g2h=1`, { next: { revalidate: 86400 } })
    const data = await res.json()
    return {
      day: typeof data.hd === 'number' ? data.hd : null,
      hebrewText: typeof data.hebrew === 'string' ? data.hebrew : '',
    }
  } catch {
    return { day: null, hebrewText: '' }
  }
}

// Same real Hebcal maj=on query as /api/tools/halachic-calendar's
// getNextErevPesach -- duplicated for the same reason getOmerStatus() above
// is (already a server component, no benefit to an internal HTTP round trip).
async function getDaysUntilPesach(): Promise<number | null> {
  try {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    const events: { title: string; date: string }[] = []
    for (const year of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&maj=on`, {
        next: { revalidate: 3600 * 24 },
      })
      const data = await res.json()
      events.push(...(data.items ?? []))
    }
    const todayStr = easternDateStr(now)
    const candidates = events
      .filter((e) => e.title?.includes('Erev Pesach') && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
    const erevPesach = candidates[0]
    if (!erevPesach) return null
    // Both sides are 'yyyy-MM-dd' calendar dates -- parse as UTC-midnight
    // and diff, rather than against now.getTime(), which pulls in the
    // current time-of-day and rounds inconsistently through the day.
    return Math.round((Date.parse(erevPesach.date) - Date.parse(todayStr)) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

type DailyContent = { title: string; body: string } | null

// calendar_content is empty except for a handful of obviously-fake
// PLACEHOLDER rows (see migration 094 + the session that added this) --
// Racquel writes the real tips/reflections later; this only proves the
// trigger-matching + fallback + rotation mechanism itself works. Picks one
// active row matching today's real trigger_type, falling back to a random
// 'general' row when nothing calendar-specific applies -- never both, and
// never more than one, so this stays a small aside, not a second content
// block competing with the date.
async function getDailyContent(propertyId: string, locale: string, triggerType: string): Promise<DailyContent> {
  const supabase = await createClient()
  const { data: specific } = await supabase
    .from('calendar_content')
    .select('title_en, title_es, body_en, body_es')
    .eq('property_id', propertyId)
    .eq('trigger_type', triggerType)
    .eq('active', true)
  let rows = specific ?? []
  if (rows.length === 0 && triggerType !== 'general') {
    const { data: general } = await supabase
      .from('calendar_content')
      .select('title_en, title_es, body_en, body_es')
      .eq('property_id', propertyId)
      .eq('trigger_type', 'general')
      .eq('active', true)
    rows = general ?? []
  }
  if (rows.length === 0) return null
  const row = rows[Math.floor(Math.random() * rows.length)]
  return {
    title: locale === 'es' && row.title_es ? row.title_es : row.title_en,
    body: locale === 'es' && row.body_es ? row.body_es : row.body_en,
  }
}

type ChametzItem = { id: string; name: string; current_qty: number; unit: string; expiration_date: string | null }

// Chametz Countdown: a filtered read against pesach_status + expiration_date,
// both already-existing fields -- no new tracking. Only queried (and the
// dashboard card only rendered) inside the real 30-day Erev Pesach window,
// same "don't clutter the dashboard with an empty-state card" convention as
// the other conditional banners on this page.
async function getChametzCountdown(propertyId: string, daysUntilPesach: number | null): Promise<ChametzItem[]> {
  if (daysUntilPesach === null || daysUntilPesach < 0 || daysUntilPesach > 30) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('inventory_items')
    .select('id, name, current_qty, unit, expiration_date')
    .eq('property_id', propertyId)
    .eq('pesach_status', 'not_kosher_for_pesach')
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .order('current_qty', { ascending: false })
    .limit(15)
  return data ?? []
}


// Reuses getUpcomingEruvTavshilin (lib/yom-tov.ts) rather than a second
// date engine -- that function already accounts for the real halachic rule
// (Erev Yom Tov = the day before the WHOLE occasion starts, not "the day
// before Friday", which breaks for a 2-day Yom Tov starting Thursday).
// Same 7-day reminder window the old hardcoded lib/eruv-tavshilin.ts used.
type EruvBanner = { name: string; eruvDate: string } | null

async function getEruvTavshilinBanner(todayIso: string): Promise<EruvBanner> {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('yom_tov_dates').select('date, holiday_name').gte('date', todayIso)
  const alerts = getUpcomingEruvTavshilin(rows || [], todayIso).filter((a) => a.daysUntil <= 7)
  const next = alerts[0]
  return next ? { name: next.name, eruvDate: next.eruvDate } : null
}

function weekBounds(today: Date) {
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  // Real bug found and fixed, not assumed: start/end retain `today`'s own
  // real time-of-day (setDate only moves the day), so the old fmt() here
  // (toISOString(), always UTC) shifted both bounds a day later on any
  // Eastern evening at/after 8pm (EDT, UTC-4) -- easternDateStr() reads the
  // local calendar date these were actually constructed in instead.
  return { startStr: easternDateStr(start), endStr: easternDateStr(end) }
}

// Confirmed live (July 10): this previously fetched a hardcoded ~9-week
// range (301 rows) on every dashboard load regardless of the current date.
// Scoped to the real current week now — the full month/multi-week view
// already exists on the real Meal Plan page, which fetches per-view rather
// than all at once.
async function getData(propertyId: string) {
  const supabase = await createClient()
  const { startStr, endStr } = weekBounds(new Date())

  // shopping_list_items has no property_id of its own (only shopping_list_id)
  // -- this was previously filtering shopping_list_items directly on
  // property_id, a column that doesn't exist on that table, which Supabase
  // silently turned into an empty result rather than a visible error.
  // Real relationship: shopping_lists.property_id -> shopping_list_items.shopping_list_id.
  const { data: list } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [meals, inventory, shopping] = await Promise.all([
    supabase.from('meal_plan_entries').select('plan_date, meal_slot, recipe_id, course, recipes(name, name_es, kosher_type)').eq('property_id', propertyId).gte('plan_date', startStr).lte('plan_date', endStr).order('plan_date'),
    supabase.from('inventory_items').select('category, name, current_qty, min_qty, photo_url, reorder_link, reorder_sources(id, retailer_name, url, is_preferred)').eq('property_id', propertyId).order('category'),
    list
      ? supabase.from('shopping_list_items').select('id, name, category, qty_needed, status, inventory_items(name_es, photo_url, reorder_link, reorder_sources(id, retailer_name, url, is_preferred))').eq('shopping_list_id', list.id).eq('status', 'pending').order('category')
      : Promise.resolve({ data: [] as any[] })
  ])
  return { meals: meals.data || [], inventory: inventory.data || [], shopping: shopping.data || [] }
}

// v1 prep timeline: a single prep_lead_days number per recipe rather than a
// full backwards-scheduling engine — surfaces as a reminder once today falls
// inside that recipe's lead window ahead of its planned date.
async function getPrepReminders(propertyId: string) {
  const supabase = await createClient()
  const today = new Date()
  // Real bug found and fixed, not assumed: format() with no timeZone reads
  // the server's own local time (Vercel = UTC), same class of bug as every
  // other date-anchoring fix tonight -- easternDateStr() anchors both ends
  // of this window to the real Eastern calendar date instead.
  const todayStr = easternDateStr(today)
  const horizon = easternDateStr(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000))

  const { data } = await supabase
    .from('meal_plan_entries')
    .select('plan_date, recipes(name, prep_lead_days)')
    .eq('property_id', propertyId)
    .gte('plan_date', todayStr)
    .lte('plan_date', horizon)

  return (data || [])
    .map((e: any) => {
      const prepLeadDays = e.recipes?.prep_lead_days
      if (!prepLeadDays) return null
      const daysUntil = Math.round((new Date(e.plan_date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil < 0 || daysUntil > prepLeadDays) return null
      return { recipeName: e.recipes.name as string, planDate: e.plan_date as string, daysUntil }
    })
    .filter((r): r is { recipeName: string; planDate: string; daysUntil: number } => r !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

// Meat/dairy/parve indicators pair color with a distinct shape and a label
// wherever they appear — colorblind-safe, not color-alone.
const KASHRUT_INFO = {
  Fleishig: { color: 'text-rust', bg: 'bg-rust', Icon: Square },
  Milchig: { color: 'text-dairy', bg: 'bg-dairy', Icon: Triangle },
  Parve: { color: 'text-sage', bg: 'bg-sage', Icon: Circle },
} as const

// Was guessing kashrut from the recipe NAME via substring match (e.g.
// "cheese"/"milk"/"butter") -- real bug confirmed live: "Butternut Squash
// and Apple Soup" (real kosher_type: Parve) matched "butter" inside
// "Butternut" and showed Milchig. recipes.kosher_type already holds the
// real value ('Meat' | 'Dairy' | 'Parve', confirmed live against every
// distinct value in the table) -- read that directly instead of guessing.
function getKashrut(kosherType: string | null | undefined): keyof typeof KASHRUT_INFO {
  if (kosherType === 'Meat') return 'Fleishig'
  if (kosherType === 'Dairy') return 'Milchig'
  return 'Parve'
}

// Same value the property layout's header subtitle already shows — that
// fetch happens in app/properties/[id]/layout.tsx, which doesn't pass data
// down to this page, so it needs its own (tiny) lookup here.
async function getPropertyName(propertyId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('name').eq('id', propertyId).single()
  return data?.name ?? null
}

// recipes has no active/archived concept in the schema (confirmed directly
// against information_schema before assuming one) — every recipe counts.
async function getRecipeCount(propertyId: string): Promise<number> {
  const supabase = await createClient()
  // Recipes are shared across every property Racquel owns (migration 072).
  const { count } = await supabase
    .from('recipes')
    .select('id, recipe_property_links!inner(property_id)', { count: 'exact', head: true })
    .eq('recipe_property_links.property_id', propertyId)
  return count ?? 0
}

// Real bug found and fixed, not assumed: the "Total Inventory" stat was
// reading inventory.length off the same array fetched for the preview list
// (getData(), no .limit()/.range()) -- PostgREST silently caps an
// unpaginated select() at the project's configured max-rows (1000 here), so
// any property with more real rows than that displays exactly 1000 with no
// error. Confirmed live: this property has 1,029 real inventory_items rows,
// not 1,076 (that figure was the sum across both of Racquel's properties,
// Main 1,029 + Country 47) -- 1,029 > 1000, so it silently truncated.
// count-only query, same pattern as getRecipeCount, isn't subject to the
// row cap at all.
async function getInventoryCount(propertyId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
  return count ?? 0
}

// Owner/manager-only "are we ready" glance: real data already collected for
// other reasons (staff_tasks, shift_handovers), no new table. Useful any day
// -- most valuable right before Shabbos/Yom Tov, but not gated to Friday the
// way the Halachic widget above is, since a manager might check this any
// afternoon.
type ReadinessSummary = {
  tasksDone: number
  tasksOpen: number
  latestHandover: { noteText: string; authorName: string | null; createdAt: string } | null
}

async function getReadinessSummary(propertyId: string): Promise<ReadinessSummary> {
  const supabase = await createClient()
  // Real bug found and fixed, not assumed: this queries staff_tasks by
  // due_date = todayStr -- format() with no timeZone read the server's own
  // UTC local time (Vercel), so on any Eastern evening at/after 8pm (EDT)
  // this could miss tasks genuinely due today or surface tomorrow's early.
  // Real functional impact, not cosmetic -- anchored to Eastern time.
  const todayStr = easternDateStr(new Date())

  const [tasksRes, handoverRes] = await Promise.all([
    supabase
      .from('staff_tasks')
      .select('status')
      .eq('property_id', propertyId)
      .eq('due_date', todayStr),
    supabase
      .from('shift_handovers')
      .select('note_text, created_at, profiles(full_name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const tasks = tasksRes.data ?? []
  const latest = handoverRes.data as { note_text: string; created_at: string; profiles: { full_name: string | null } | null } | null

  return {
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    tasksOpen: tasks.filter((t) => t.status !== 'done').length,
    latestHandover: latest
      ? { noteText: latest.note_text, authorName: latest.profiles?.full_name ?? null, createdAt: latest.created_at }
      : null,
  }
}

// Prep Ahead Assistant: freezer-triggered reminder, list-only (never writes
// staff_tasks). Real data check before picking a trigger source: prep_lead_days
// exists as a column but is set on only 1 of 316 recipes and has zero overlap
// with the 156 recipes tagged 'freezer-friendly' -- using prep_lead_days as
// the gate would mean this almost never fires. The tag is the real, populated
// signal; prep_lead_days is still used to phrase the reminder when a recipe
// happens to have it set, since that's real information when present.
const PREP_AHEAD_WINDOW_DAYS = 4 // same near-term window as the recipes page's own "expiring soon" default, for consistency

type PrepAheadReminder = { recipeId: string | null; recipeName: string; planDate: string; prepLeadDays: number | null }

async function getPrepAheadReminders(propertyId: string): Promise<PrepAheadReminder[]> {
  const supabase = await createClient()
  // Real bug found and fixed, not assumed: this previously started the
  // window at today (gte todayStr), so a meal scheduled for TODAY showed up
  // with "pull it out ahead of time" copy -- a contradiction, since there's
  // no ahead-of-time left once it's the day of. Confirmed live: both
  // Cauliflower Zucchini Soup and Caramelized Onion Kugel were scheduled
  // for 2026-07-15, today, with prep_lead_days null (hence the generic
  // fallback wording). Starts strictly after today now.
  //
  // Real bug found and fixed, not assumed: format() with no timeZone read
  // the server's own UTC local time (Vercel), same class of bug as every
  // other fix tonight -- anchored both ends of this window to the real
  // Eastern calendar date instead.
  const todayStr = easternDateStr(new Date())
  const horizon = easternDateStr(new Date(Date.now() + PREP_AHEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000))

  // Dip/salad/dessert are excluded even if freezer-friendly -- nobody needs
  // a multi-day advance reminder for hummus or a salad dressing. course is
  // a plain column on this table (not an embedded relation like tags), so
  // this filters server-side rather than fetching rows just to discard them.
  const { data } = await supabase
    .from('meal_plan_entries')
    .select('plan_date, recipe_id, recipes(name, tags, prep_lead_days)')
    .eq('property_id', propertyId)
    .gt('plan_date', todayStr)
    .lte('plan_date', horizon)
    .in('course', ['protein', 'soup', 'starch', 'vege'])

  return (data || [])
    .filter((e: any) => e.recipes?.tags?.includes('freezer-friendly'))
    .map((e: any) => ({
      recipeId: e.recipe_id ?? null,
      recipeName: e.recipes.name as string,
      planDate: e.plan_date as string,
      prepLeadDays: e.recipes.prep_lead_days ?? null,
    }))
    .sort((a, b) => (a.planDate < b.planDate ? -1 : 1))
}

// Property-level, persisted (not a session preference) -- reuses the exact
// feature_flags jsonb column already holding auto_restock/pesach_mode/
// guest_taste_memory. Defaults to enabled (absence of the key, or anything
// other than an explicit false) so a brand-new property starts with the
// "every day" cadence Racquel asked for, not opt-in.
async function getPrepAheadEnabled(propertyId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single()
  const flags = (data?.feature_flags ?? {}) as Record<string, unknown>
  return flags.prep_ahead_assistant !== false
}

async function getUserRole(propertyId: string): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle()
  return data?.role ?? null
}

// Brass pin-dot accent -- part of the original Concept B spec ("brass
// pin-dot accent on card corners") that never actually got implemented in
// the first repaint pass. `lg` for the 4 main top-section cards (Today/
// Candle/Pantry/Meal Plan), `sm` for the Quick Action tiles. Not used on
// Readiness or the stat cards -- neither is part of the reference mockup's
// own pinned-card set.
async function getTehillim(hebrewDay: number | null) {
  if (!hebrewDay) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('tehillim_daily_cycle')
    .select('perek_start, perek_end, note')
    .eq('hebrew_day', hebrewDay)
    .single()
  return data
}

export default async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params
  const t = await getTranslations('dashboard')
  const locale = await getLocale()
  const [{ meals, shopping }, hebcal, hebrewInfo, prepReminders, propertyName, recipeCount, readiness, userRole, prepAheadReminders, prepAheadEnabled, inventoryCount, widgetPrefs, todaysMeals, lowStockItems] = await Promise.all([
    getData(propertyId),
    getHebcal(),
    getHebrewInfo(),
    getPrepReminders(propertyId),
    getPropertyName(propertyId),
    getRecipeCount(propertyId),
    getReadinessSummary(propertyId),
    getUserRole(propertyId),
    getPrepAheadReminders(propertyId),
    getPrepAheadEnabled(propertyId),
    getInventoryCount(propertyId),
    getWidgetPrefs(propertyId),
    getTodaysMealPlan(propertyId),
    getLowStockAlerts(propertyId),
  ])
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager'
  const tehillim = await getTehillim(hebrewInfo.day)

  // Shopping List widget's image: Racquel's own direction was "pics of
  // ingredients" -- the real items actually pending on the list, each with
  // its own real photo (not a detached mosaic that loses the name-to-photo
  // connection). `shopping` already carries each item's linked
  // inventory_items.photo_url (fetched in getData() above for the fuller
  // shopping-list-with-photos section further down this page); this just
  // reuses that same embed rather than a second query. Capped at 5 to match
  // the same preview-list convention Low Stock Alerts already uses.
  // SS-150: widened from {id, name, photoUrl} so the "At a Glance" tile can
  // carry the same qty/Order-button functionality as the standalone
  // Shopping List card below it -- reuses the same `shopping` embed
  // (inventory_items.reorder_sources), no second query.
  const shoppingListPreview = shopping.slice(0, 5).map((s: any) => ({
    id: s.id,
    name: s.name,
    // shopping_list_items has no name_es of its own (confirmed against the
    // real schema) -- get_shopping_list_with_inventory's own RPC pulls ES
    // display text from the linked inventory_items row for the same
    // reason, same join used here.
    nameEs: s.inventory_items?.name_es ?? null,
    photoUrl: s.inventory_items?.photo_url ?? null,
    qtyNeeded: s.qty_needed ?? null,
    reorderSources: s.inventory_items?.reorder_sources ?? null,
    reorderLink: s.inventory_items?.reorder_link ?? null,
  }))

  const now = new Date()

  // isFriday(now)/isSaturday(now)/now.getHours() all read the JS Date in
  // whatever timezone the server process itself runs in -- Vercel's
  // serverless functions default to UTC, not Lakewood, NJ. Real bug found
  // while re-verifying the Motzei Shabbos banner (reported as "doesn't look
  // present"): at a real Eastern-time Saturday evening, UTC has usually
  // already rolled over to Sunday, so isSaturday(now) was false exactly
  // when it needed to be true. Same root cause would have affected the
  // pre-existing isShabbos flag too (Shabbos Mode styling), not just the
  // new banner -- fixed both via the actual Lakewood-local weekday/hour.
  const easternParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const easternPartsMap = Object.fromEntries(easternParts.map((p) => [p.type, p.value]))
  const easternWeekday = easternPartsMap.weekday ?? ''
  const easternHour = parseInt(easternPartsMap.hour ?? '0', 10)
  const isEasternFriday = easternWeekday === 'Fri'
  const isEasternSaturday = easternWeekday === 'Sat'
  const isEasternSunday = easternWeekday === 'Sun'

  // The candle-lighting line otherwise reads as "tonight" no matter what day
  // it's viewed on -- labeling it with its actual date removes that
  // ambiguity without needing to hide the widget on non-Fridays.
  const candleDateLabel = hebcal.candleDate
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(hebcal.candleDate))
    : null

  const isShabbos = (isEasternFriday && hebcal.candleDate && now > new Date(new Date(hebcal.candleDate).getTime() - 3600000)) ||
                    (isEasternSaturday && hebcal.havdalahDate && now < new Date(hebcal.havdalahDate))

  // Motzei Shabbos casual-suggestions banner: Saturday evening, no backend --
  // just a time-of-week nudge toward the easiest post-Shabbos dinner options.
  // 6pm flat cutoff rather than the real (seasonal) Havdalah time since this
  // is a casual suggestion, not a halachic determination.
  const isMotzeiShabbos = isEasternSaturday && easternHour >= 18

  // Tomorrow's (and today's) real Eastern calendar date, built from
  // Date.UTC + UTC getters (not date-fns format(), which reads
  // local-runtime parts) so this stays correct regardless of what timezone
  // the server process itself runs in.
  const easternTodayUTC = Date.UTC(
    parseInt(easternPartsMap.year ?? '1970', 10),
    parseInt(easternPartsMap.month ?? '1', 10) - 1,
    parseInt(easternPartsMap.day ?? '1', 10)
  )
  const easternTodayDate = new Date(easternTodayUTC)
  const easternTodayStr = `${easternTodayDate.getUTCFullYear()}-${String(easternTodayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(easternTodayDate.getUTCDate()).padStart(2, '0')}`
  const tomorrowUTC = new Date(easternTodayUTC + 24 * 60 * 60 * 1000)
  const easternTomorrowStr = `${tomorrowUTC.getUTCFullYear()}-${String(tomorrowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowUTC.getUTCDate()).padStart(2, '0')}`

  const [omerTitle, isErevYomTov, eruvTavshilin, daysUntilPesach, roshChodeshStatus, isFastDayToday, majorHolidayToday, isNineDaysToday, isYomTovToday] = await Promise.all([
    getOmerStatus(),
    getIsErevYomTov(easternTomorrowStr),
    getEruvTavshilinBanner(easternTodayStr),
    getDaysUntilPesach(),
    getRoshChodeshStatus(easternTodayStr),
    getIsFastDayToday(easternTodayStr),
    getMajorHolidayToday(easternTodayStr),
    getIsNineDays(),
    getIsErevYomTov(easternTodayStr), // same yom_tov_dates check, just today's date instead of tomorrow's
  ])
  const chametzItems = await getChametzCountdown(propertyId, daysUntilPesach)

  // Today's Meal Plan widget's hardcoded dinner course order: Shabbos/Yom
  // Tov gets a Dessert course, weekdays never do. Real day-of-week (Fri/Sat),
  // not the time-sensitive isShabbos boolean above (which is false all
  // Friday morning, before candle-lighting, even though Friday NIGHT's
  // dinner is genuinely a Shabbos meal) -- plus a real Yom Tov date check,
  // since Yom Tov can land on any weekday, not just Fri/Sat.
  const isShabbosOrYomTovDinner = isEasternFriday || isEasternSaturday || isYomTovToday

  // Priority order for which single rotating tip/reflection shows today --
  // most specific real calendar moment wins; 'general' is the catch-all
  // when none of the others apply (the common case almost every day).
  // resolveTriggerType() is shared with the Staff (My Day) landing page's
  // notice banner (lib/calendar-trigger-type.ts) -- one priority chain,
  // not two that could quietly drift apart.
  const todayTriggerType = resolveTriggerType({
    majorHolidayToday,
    isFastDayToday,
    isNineDaysToday,
    isShabbos,
    roshChodeshToday: !!roshChodeshStatus?.isToday,
    omerTitle,
    isErevYomTov,
  })
  const dailyContent = await getDailyContent(propertyId, locale, todayTriggerType)

  // Real bug found and fixed, not assumed: meal_plan_entries is one row per
  // dish/course (confirmed live -- 38 rows for the week, 5-6 courses × 7
  // dinners), so meals.length was counting dishes, not meals, everywhere it
  // was used as "X meals planned." A real meal is a distinct
  // plan_date+meal_slot pair -- 7 that week, not 38.
  const distinctMealCount = new Set(meals.map((m: any) => `${m.plan_date}|${m.meal_slot}`)).size

  return (
    <div
      className={`min-h-screen p-4 md:p-6 font-interDisplay transition-all ${isShabbos ? 'bg-amber-50' : 'bg-linen'}`}
      style={{
        backgroundImage: `linear-gradient(118deg, rgba(255,250,240,0) 0%, rgba(255,244,222,0.45) 42%, rgba(255,250,240,0) 78%),
          radial-gradient(circle at 10% 6%, rgba(214,228,240,0.6) 0%, transparent 42%),
          radial-gradient(circle at 94% 88%, rgba(234,221,199,0.6) 0%, transparent 42%),
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.075'/%3E%3C/svg%3E")`,
      }}
    >
      <div className="max-w-[1180px] mx-auto pb-16">
        {/* New direction (2026-07-15) -- full repaint, replacing Bold
            Direction on every section of Home. Individual floating cards on
            an open linen ground (matching the approved Concept B mockup)
            instead of one big wrapping card -- that's the defining shape
            change, not a color swap. Card-hierarchy rule used throughout:
            section-level containers get the full card treatment (cardBorder
            + shadow-card + xl3 radius); list rows *inside* a section get a
            lighter, shadowless border only, so lists don't read as cards
            nested inside cards. */}

        <div className="grid grid-cols-12 gap-[14px] mb-[14px] items-start">
          {/* TODAY + CANDLE LIGHTING -- height-match refactor: state lifted
              out of both cards into TodayCandleLightingRow, which stretches
              them to match each other only when BOTH are expanded, and
              lets each size independently the moment either collapses (the
              behavior the collapse-container-shrink fix needed). Scoped to
              its own nested grid so the outer items-start here still
              governs Pantry/Meal Plan below unaffected. */}
          <TodayCandleLightingRow
            todayHeader={
              <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
                {t('todayHeader')}
              </div>
            }
            todayContent={
              <div className={`flex-1 flex flex-col items-center justify-center text-center py-[16px] px-[20px] gap-[8px] ${isShabbos ? 'bg-amber-100' : 'bg-card'}`}>
                {propertyName && (
                  <p className="text-[10px] tracking-[0.18em] uppercase font-normal text-brass border-b border-brass inline-block pb-1.5">
                    {propertyName}
                  </p>
                )}
                {/* Compact pass (2026-07-17): the card was reading as a hero
                    banner rather than compact/informational -- 44px brought
                    down to 32px, still font-display/Cormorant, and every
                    child's individual margin classes replaced by a single
                    gap-[8px] on this flex container so spacing between
                    elements stays uniform (and correctly skips elements that
                    don't render, like a manual-margin chain can't). */}
                <p lang="he" dir="rtl" className="font-display font-normal text-[32px] text-denim leading-[1.05] tracking-[0.02em]">
                  {hebrewInfo.hebrewText}
                </p>
                <p className="font-interDisplay text-[11px] uppercase tracking-[0.1em] text-dusk">
                  {/* Real bug found and fixed, not assumed: format(now, ...)
                      with no timeZone read the server's own UTC local time
                      (Vercel), same class of bug as every other fix
                      tonight -- on any Eastern evening at/after 8pm (EDT)
                      this prominent Today-card line would show TOMORROW's
                      weekday/date. Explicit America/New_York timeZone,
                      same technique already used for candleDateLabel
                      below. */}
                  {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(now)}
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {hebcal.parsha && (
                    <span lang="he" dir="rtl" className="bg-denim text-white text-xs font-medium px-4 py-1.5 rounded-full">
                      {hebcal.parsha}
                    </span>
                  )}
                  {tehillim && (
                    <span className="bg-mist text-denim text-xs font-medium px-4 py-1.5 rounded-full">
                      Tehillim {tehillim.perek_start}
                      {tehillim.perek_end !== tehillim.perek_start ? `–${tehillim.perek_end}` : ''}
                    </span>
                  )}
                  {isShabbos && (
                    <span className="bg-mist text-denim text-xs font-medium px-4 py-1.5 rounded-full">{t('shabbosModeActive')}</span>
                  )}
                </div>
                {omerTitle && <p className="text-xs text-dusk">{omerTitle}</p>}
                {roshChodeshStatus && (
                  <p className="text-xs text-brass font-medium">
                    {roshChodeshStatus.isToday
                      ? t('roshChodesh.today', { month: roshChodeshStatus.monthName })
                      : t('roshChodesh.upcoming', { month: roshChodeshStatus.monthName, days: roshChodeshStatus.daysUntil })}
                  </p>
                )}
                {/* Deliberately one small aside, never both a Rosh Chodesh
                    callout AND a full second content block competing for
                    attention -- title + 1-2 lines max, same dusk/brass
                    palette as everything else in this card so it reads as
                    part of Today, not a separate feature bolted on. */}
                {dailyContent && (
                  <div className="pt-2 border-t border-cardBorder/60 max-w-[320px]">
                    <p className="text-[10px] tracking-[0.14em] uppercase font-semibold text-brass mb-1">{dailyContent.title}</p>
                    <p className="text-xs text-dusk leading-relaxed">{dailyContent.body}</p>
                  </div>
                )}
              </div>
            }
            candleHeader={
              <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5 flex items-center gap-2">
                <Flame size={13} className="text-white/80" aria-hidden="true" />
                {t('candle.label')}
              </div>
            }
            candleContent={
              <>
                <div
                  // Per Racquel's reference image, the photo is meant to
                  // dominate this card -- large majority of the height, thin
                  // header, compact footer -- not just a slightly-taller
                  // strip above a big padded footer. So the flex-1 that used
                  // to live on the footer below now lives here instead: this
                  // grows to absorb any extra height from the Today
                  // height-match (TodayCandleLightingRow's stretch), while
                  // the 230px min-height is the floor for every other case
                  // (standalone, or Today collapsed). backgroundSize: cover
                  // means growing this never stretches/distorts the photo,
                  // it just shows more of it.
                  className="min-h-[230px] w-full bg-denim flex-1"
                  style={{
                    backgroundImage: `url('https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public/dashboard-photos/candle.jpeg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                {/* shrink-0 + no flex-1: this used to be the element that
                    grew to absorb extra height (see above), which is exactly
                    why it read as an oversized block -- LocationZmanim's own
                    dark variant already renders as two tight lines, all the
                    extra bulk was this wrapper's padding centered in leftover
                    flex space, not the content itself. Now it always sizes
                    to its own content, matching the reference's "compact
                    footer, two tight lines." */}
                <div className="bg-denim px-5 py-4 flex items-center justify-center shrink-0">
                  <LocationZmanim
                    variant="dark"
                    propertyName={propertyName}
                    defaultTime={hebcal.candleTime}
                    defaultDateLabel={candleDateLabel}
                  />
                </div>
              </>
            }
          />

          {/* QUICK CAPTURE -- Type A (header bar + free content), replaces
              the old Readiness card in the same slot/position. NOT gated to
              owner/manager -- unlike Readiness, this serves whoever's
              actually restocking, not just management. Three actions, same
              visual weight as the old task-summary row: take a photo
              (routes to a new search-existing-item-then-attach-photo tool,
              since neither existing photo tool -- identify-item or
              capture-photo -- actually attaches immediately to an existing
              item; both either create a new item or defer matching to a
              later cleanup pass, which is exactly the batch-sweep pattern
              this is meant to replace), scan a QR (existing /scan route),
              add product (existing manual-entry sheet on /inventory, now
              reachable in one tap via ?new=1 instead of requiring the
              user find "Add Item" themselves once there).

              The old task-count/handover-preview content is NOT duplicated
              anywhere else in the app (verified: Staff Task Center shows
              an all-time Kanban by status, not a same-day done/open count,
              and has zero shift_handovers reference anywhere) -- so per
              the explicit instruction not to delete content that's the
              only place it shows, it's relocated below as a slim
              owner/manager-only strip rather than dropped. Flagged in the
              session report; say the word if it should just go away
              instead. */}
          <div className="col-span-12 rounded-xl3 border border-cardBorder shadow-card overflow-hidden transition-shadow hover:shadow-cardHover">
            <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
              {t('quickCapture.headerLabel')}
            </div>
            <div className="bg-card px-[22px] py-4">
              <div className="grid grid-cols-3 gap-3">
                <Link
                  href={`/properties/${propertyId}/tools/quick-photo`}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl2 bg-mist border border-brass/30 py-4 px-2 text-center hover:shadow-card transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                >
                  <Camera size={26} className="text-denim" aria-hidden="true" />
                  <span className="text-xs font-medium text-denim">{t('quickCapture.takePhoto')}</span>
                </Link>
                <Link
                  href={`/properties/${propertyId}/scan`}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl2 bg-mist border border-brass/30 py-4 px-2 text-center hover:shadow-card transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                >
                  <Scan size={26} className="text-denim" aria-hidden="true" />
                  <span className="text-xs font-medium text-denim">{t('quickCapture.scanQr')}</span>
                </Link>
                <Link
                  href={`/properties/${propertyId}/inventory?new=1`}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl2 bg-mist border border-brass/30 py-4 px-2 text-center hover:shadow-card transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                >
                  <Plus size={26} className="text-denim" aria-hidden="true" />
                  <span className="text-xs font-medium text-denim">{t('quickCapture.addProduct')}</span>
                </Link>
              </div>

              {/* Staff-only My Day link (2026-07-20): confirmed real gap, not
                  a stale report -- My Day has real entry points in
                  DesktopNav.tsx and /sitemap, but DesktopNav is `hidden
                  md:flex` (invisible on mobile) and MobileBottomNav.tsx is
                  deliberately a fixed 5 items with no room for it. On a
                  phone, a staff-role viewer had zero visible path to their
                  own home page -- the owner/manager readiness strip below
                  doesn't render for them at all. */}
              {!isOwnerOrManager && (
                <div className="mt-3 pt-3 border-t border-cardBorder">
                  <Link
                    href={`/properties/${propertyId}/my-day`}
                    className="text-xs font-semibold text-brass hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                  >
                    {t('quickCapture.myDayLink')}
                  </Link>
                </div>
              )}

              {isOwnerOrManager && (
                <div className="mt-3 pt-3 border-t border-cardBorder flex flex-col gap-1">
                  <p className="text-xs text-denim">
                    {readiness.tasksDone + readiness.tasksOpen === 0 ? (
                      t('readiness.noTasksToday')
                    ) : (
                      <>
                        <span className="font-semibold">{readiness.tasksDone}</span> {readiness.tasksDone === 1 ? t('readiness.task') : t('readiness.tasks')} {t('readiness.done')}{' '}
                        <span className={`font-semibold ${readiness.tasksOpen > 0 ? 'text-rust' : ''}`}>{readiness.tasksOpen}</span> {t('readiness.leftToday')}
                      </>
                    )}
                    {' '}{t('readiness.candleLighting')} <bdi dir="ltr">{hebcal.candleTime}</bdi>.
                  </p>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-dusk">
                      {readiness.latestHandover ? (
                        <>
                          {t('readiness.lastHandover')}{readiness.latestHandover.authorName ? ` (${readiness.latestHandover.authorName})` : ''}: "
                          {readiness.latestHandover.noteText.length > 80
                            ? `${readiness.latestHandover.noteText.slice(0, 80)}…`
                            : readiness.latestHandover.noteText}
                          "
                        </>
                      ) : (
                        t('readiness.noHandoverNotes')
                      )}
                    </p>
                    <Link
                      href={`/properties/${propertyId}/shift-handover`}
                      className="text-xs font-semibold text-brass hover:underline shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
                    >
                      {t('readiness.viewBrief')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS -- own category, not a Type A/B/C variant: no
              denim header bar. New this round: a small-caps brass eyebrow
              label above the icon, same text as the title beneath it, per
              explicit instruction. 5 real destinations (Inventory added a
              few rounds back). No pin dot (2026-07-20): these are pure nav
              links with nothing to collapse -- a decorative pin here read
              as a broken toggle affordance per Racquel's RULE 1. */}
          <div className="col-span-12 grid grid-cols-2 sm:grid-cols-5 gap-[14px]">
            {([
              [`/properties/${propertyId}/meal-plan`, Calendar, t('quickActions.planMeal'), t('quickActions.planMealSubtitle'), undefined] as const,
              [`/properties/${propertyId}/recipes`, BookOpen, t('quickActions.recipesTile'), `${recipeCount} ${recipeCount === 1 ? t('recipe') : t('recipes')}`, undefined] as const,
              [`/properties/${propertyId}/recipes`, Plus, t('quickActions.addRecipe'), t('quickActions.addRecipeSubtitle'), undefined] as const,
              [`/properties/${propertyId}/shopping-list`, ShoppingCart, t('quickActions.shoppingList'), t('quickActions.shoppingListSubtitle'), undefined] as const,
              [`/properties/${propertyId}/inventory`, Package, t('quickActions.inventory'), t('quickActions.inventorySubtitle'), undefined] as const,
            ]).map(([href, Icon, label, subtitle, ariaLabel]) => (
              <Link
                key={label}
                href={href}
                aria-label={ariaLabel}
                className="min-h-[128px] flex flex-col items-center justify-center gap-[11px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-[18px] shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
              >
                <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{label}</span>
                <Icon size={36} className="text-denim" aria-hidden="true" />
                <span className="font-display font-normal text-[18px] text-denim text-center">{label}</span>
                <span className="text-[11px] text-dusk text-center">{subtitle}</span>
              </Link>
            ))}
          </div>

          {/* PANTRY / MEAL PLAN -- Type C (header bar + side-by-side photo/
              text), moved to last position per the corrected page order.
              Photo is partial-width (~42%) beside the text block, not a
              full-bleed band above/behind it -- corrected from an earlier
              full-width pass. Real photos still live in Supabase Storage
              (dashboard-photos/pantry.jpeg, mealplan.jpg); a mist fallback
              fill shows if either ever fails to load. */}
          <CollapsibleCard
            cardId="pantry"
            href={`/properties/${propertyId}/inventory`}
            className="col-span-12 md:col-span-6 rounded-xl3 border border-cardBorder shadow-card overflow-hidden flex flex-col transition-shadow hover:shadow-cardHover"
            header={
              <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
                {t('pantryPillLabel')}
              </div>
            }
          >
            <div className="flex-1 flex min-h-[120px]">
              <div
                className="w-[42%] shrink-0 bg-mist"
                style={{
                  backgroundImage: "url('https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public/dashboard-photos/pantry.jpeg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="flex-1 flex flex-col justify-center py-[22px] px-5">
                <p className="font-display text-[22px] font-normal text-denim mb-[14px]">
                  {inventoryCount.toLocaleString('en-US')} {inventoryCount === 1 ? t('item') : t('items')}
                </p>
                <p className="text-[12px] text-dusk">{t('pantryCard.subtext')}</p>
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            cardId="meal-plan-this-week"
            href={`/properties/${propertyId}/meal-plan`}
            className="col-span-12 md:col-span-6 rounded-xl3 border border-cardBorder shadow-card overflow-hidden flex flex-col transition-shadow hover:shadow-cardHover"
            header={
              <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
                {t('mealPlanPillLabel')}
              </div>
            }
          >
            <div className="flex-1 flex min-h-[120px]">
              <div
                className="w-[42%] shrink-0 bg-mist"
                style={{
                  backgroundImage: "url('https://jfaaqzrezcrkkidlsbwj.supabase.co/storage/v1/object/public/dashboard-photos/mealplan.jpg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="flex-1 flex flex-col justify-center py-[22px] px-5">
                <p className="font-display text-[22px] font-normal text-denim mb-[14px]">
                  {distinctMealCount} {distinctMealCount === 1 ? t('meal') : t('meals')}
                </p>
                <p className="text-[12px] text-dusk">{t('mealPlanCard.subtext')}</p>
              </div>
            </div>
          </CollapsibleCard>
        </div>

        {/* Quick-glance overview -- 3 real counts, restored (was briefly 2
            with Meals Planned removed on the theory distinctMealCount was
            already duplicated by the THIS WEEK card -- put back per
            explicit request, in Total Inventory / Meals Planned / Active
            Recipes order, not the original Total Inventory / Active
            Recipes / Meals Planned order). */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-4 text-center">
            <Package size={18} strokeWidth={1.5} className="text-brass mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-display text-denim">{inventoryCount.toLocaleString('en-US')}</div>
            <div className="text-xs text-dusk">{t('stats.totalInventory')}</div>
          </div>
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-4 text-center">
            <Calendar size={18} strokeWidth={1.5} className="text-brass mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-display text-denim">{distinctMealCount}</div>
            <div className="text-xs text-dusk">{t('stats.mealsPlanned')}</div>
          </div>
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-4 text-center">
            <BookOpen size={18} strokeWidth={1.5} className="text-brass mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-display text-denim">{recipeCount}</div>
            <div className="text-xs text-dusk">{t('stats.activeRecipes')}</div>
          </div>
        </div>

        <DashboardWidgets
          propertyId={propertyId}
          initialPrefs={widgetPrefs}
          todaysMeals={todaysMeals}
          lowStockItems={lowStockItems}
          shoppingListCount={shopping.length}
          shoppingListPreview={shoppingListPreview}
          prepAheadReminders={prepAheadReminders}
          prepAheadEnabled={prepAheadEnabled}
          canManagePrepAhead={isOwnerOrManager}
          isShabbosOrYomTovDinner={isShabbosOrYomTovDinner}
        />

        {prepReminders.length > 0 && (
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-5 mb-4">
            <h2 className="text-sm font-display font-semibold text-denim mb-2 flex items-center gap-1.5">
              <Clock size={16} strokeWidth={1.75} className="text-brass" aria-hidden="true" /> {t('prepReminders.heading')}
            </h2>
            <ul className="space-y-1.5">
              {prepReminders.map((r, i) => (
                <li key={i} className="text-sm text-denim">
                  <span className="font-medium">{r.recipeName}</span> — {r.daysUntil === 0 ? t('prepReminders.startPrepToday') : `${t('prepReminders.startPrepBy')} ${format(parseISO(r.planDate), 'EEEE')}, ${t('prepReminders.neededFor')}`}{' '}
                  {format(parseISO(r.planDate), 'EEEE, MMM d')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {eruvTavshilin && (
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-5 mb-4">
            <h2 className="text-sm font-display font-semibold text-denim mb-2 flex items-center gap-1.5">
              <Flame size={16} strokeWidth={1.75} className="text-brass" aria-hidden="true" /> {t('eruvTavshilin.heading')}
            </h2>
            <p className="text-sm text-denim">
              {t('eruvTavshilin.makeOn')} <span className="font-medium">{format(parseISO(eruvTavshilin.eruvDate), 'EEEE, MMM d')}</span>, {t('eruvTavshilin.before')} {eruvTavshilin.name} {t('eruvTavshilin.begins')}
            </p>
          </div>
        )}

        {chametzItems.length > 0 && (
          <Link
            href={`/properties/${propertyId}/inventory`}
            className="block rounded-xl3 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow bg-card p-5 mb-4"
          >
            <h2 className="text-sm font-display font-semibold text-denim mb-1 flex items-center gap-1.5">
              <Package size={16} strokeWidth={1.75} className="text-brass" aria-hidden="true" />
              {daysUntilPesach} {daysUntilPesach === 1 ? t('chametz.day') : t('chametz.days')} {t('chametz.untilPesach')}
            </h2>
            <p className="text-sm text-denim">
              {chametzItems.length} {chametzItems.length === 1 ? t('chametz.item') : t('chametz.items')} {t('chametz.markedNotForPesach')}{' '}
              {chametzItems.slice(0, 3).map((i) => i.name).join(', ')}
              {chametzItems.length > 3 ? t('chametz.moreCount', { count: chametzItems.length - 3 }) : ''} — {t('chametz.tapToOpenInventory')}
            </p>
          </Link>
        )}

        {isMotzeiShabbos && (
          <div className="rounded-xl3 border border-cardBorder shadow-card bg-card p-5 mb-4">
            <h2 className="text-sm font-display font-semibold text-denim mb-2 flex items-center gap-1.5">
              <UtensilsCrossed size={16} strokeWidth={1.75} className="text-brass" aria-hidden="true" /> {t('motzeiShabbos.heading')}
            </h2>
            <div className="flex gap-2 flex-wrap">
              {[t('motzeiShabbos.pizza'), t('motzeiShabbos.pasta'), t('motzeiShabbos.salad')].map((suggestion) => (
                <span key={suggestion} className="text-sm px-3 py-1.5 bg-mist rounded-full text-denim">
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* The full "This Week's Meals" list (heading, kashrut legend,
            day-by-day breakdown) was removed from the Dashboard entirely --
            it still exists on the real Plan page, just not duplicated here.
            The "THIS WEEK" pantry-style card above (photo + meal count,
            linking to /meal-plan) stays untouched. SS-150: the standalone
            Shopping List card that used to open this sidebar (category-
            grouped, checkbox/photo/qty/Order-button rows) was deleted --
            the "At a Glance" Shopping List tile above (DashboardWidgets.tsx)
            now carries that exact same functionality per-item, so this was
            a genuine duplicate once the tile did the job, not just a
            visual echo. The standalone "Inventory Items" card that used to
            sit here (its own photo/qty-bar/Order rows, separate from the
            Low Stock Alerts tile above showing the same items the same
            way) was removed for the same reason, per Racquel July 19 --
            its one non-duplicate piece, the "+ Add Item" link, moved into
            the Low Stock Alerts tile itself (DashboardWidgets.tsx). */}
        {/* Mobile bottom nav only shows Home/Recipes/Scan/Shopping/Inventory
            — Tools/Staff/Settings are reachable from here instead of being
            crammed into the bottom bar. Labels now lives inside Inventory and
            Handover inside Staff's Handover tab, so neither needs its own
            entry point here anymore. Desktop already has these in the
            nav's "More" dropdown, so this block is mobile-only. */}
        <div className="md:hidden mt-6 pt-4 border-t border-cardBorder flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href={`/properties/${propertyId}/tools`} className="text-dusk hover:text-denim underline underline-offset-2">
            {t('mobileFooter.tools')}
          </Link>
          <Link href={`/properties/${propertyId}/staff`} className="text-dusk hover:text-denim underline underline-offset-2">
            {t('mobileFooter.staff')}
          </Link>
          {/* Both exist and work already -- Room Photo Review lives inside
              the Tools grid, Procurement is its own top-level page -- this
              is purely a findability fix, matching the same two shortcuts
              added to the desktop "More" dropdown. managerOnly-equivalent
              gate here since both pages already redirect staff server-side. */}
          {isOwnerOrManager && (
            <Link href={`/properties/${propertyId}/tools/photo-review`} className="text-dusk hover:text-denim underline underline-offset-2">
              {t('mobileFooter.photoReview')}
            </Link>
          )}
          {isOwnerOrManager && (
            <Link href="/procurement" className="text-dusk hover:text-denim underline underline-offset-2">
              {t('mobileFooter.procurement')}
            </Link>
          )}
          <Link href={`/properties/${propertyId}/settings`} className="text-dusk hover:text-denim underline underline-offset-2">
            {t('mobileFooter.settings')}
          </Link>
        </div>

        {isShabbos && (
          // bottom-24 on md+ so this doesn't sit on top of the floating
          // Scan button, which occupies bottom-6 right-6 on desktop only.
          <div className="fixed bottom-4 right-4 md:bottom-24 bg-amber-900 text-amber-50 px-4 py-2 rounded-full text-sm shadow-lg">
            {t('shabbosModeBanner')}
          </div>
        )}
      </div>
      <FloatingScanButton propertyId={propertyId} />
    </div>
  )
}
