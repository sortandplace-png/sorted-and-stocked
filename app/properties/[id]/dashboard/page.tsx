// app/properties/[id]/dashboard/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, Package, Plus, Scan, ShoppingBag, ShoppingCart, Square, Circle, Triangle, BookOpen, Flame, UtensilsCrossed, BookMarked } from 'lucide-react'
import FloatingScanButton from '@/components/FloatingScanButton'
import PrepAheadAssistant from '@/components/PrepAheadAssistant'
import { COURSES } from '@/lib/course-constants'
import { getUpcomingEruvTavshilin } from '@/lib/yom-tov'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getHebcal() {
  // Lakewood, NJ - geonameid 5100280. Candle-lighting/parsha only change
  // once a week and the Hebrew date only once a day — 1h revalidation was
  // needlessly frequent for values this stable, confirmed nothing else on
  // this page depends on sub-day freshness.
  try {
    const res = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=5100280&M=on&lg=he', { next: { revalidate: 86400 } })
    const data = await res.json()
    const candle = data.items?.find((i: any) => i.category === 'candles')
    const havdalah = data.items?.find((i: any) => i.category === 'havdalah')
    // Was stripping the English string "Candle lighting: " out of candle.title
    // — but with lg=he, candle.title is Hebrew, so that .replace() was always
    // a silent no-op and this was actually rendering the candle-lighting
    // item's raw Hebrew text as if it were the parsha name. The real parsha
    // name lives on its own item, category === 'parashat' (confirmed live
    // against the real Hebcal response).
    const parashat = data.items?.find((i: any) => i.category === 'parashat')
    return {
      candleTime: candle ? new Date(candle.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '8:12pm',
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
async function getHebrewInfo(): Promise<{ day: number | null; hebrewText: string }> {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
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

// Same real Hebcal omer logic as /api/tools/halachic-calendar (the
// existing Halachic Calendar tool card) -- duplicated rather than
// fetched over HTTP since this is already a server component and an
// internal fetch would need an absolute URL for no real benefit.
async function getOmerStatus(): Promise<string | null> {
  try {
    const now = new Date()
    const res = await fetch(
      `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${now.getFullYear()}&month=${now.getMonth() + 1}&o=on`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const today = format(now, 'yyyy-MM-dd')
    const omerItem = data.items?.find((i: any) => i.category === 'omer' && i.date?.startsWith(today))
    return omerItem?.title ?? null
  } catch {
    return null
  }
}

// yom_tov_dates isn't property-scoped (shared calendar data, same table
// the header countdown pill already reads) -- a plain date match is enough.
async function getIsErevYomTov(tomorrowStr: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('yom_tov_dates').select('date').eq('date', tomorrowStr).maybeSingle()
  return !!data
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

// Real, live Reset Checklists already exist (ResetChecklistClient.tsx,
// task_templates + reset_checklist_progress, reachable at
// /tools/reset-checklist) -- confirmed both "Erev Shabbos Prep" and
// "Post-Shabbos Deep Reset" templates are real rows for this property, not
// something to build. This only decides WHEN to surface a Dashboard
// reminder pointing at that already-real page.
//
// Reuses the exact same candleDate the existing Erev-Shabbos-window check
// needs (safe: it's always looking forward to a not-yet-passed Friday, no
// ambiguity). Deliberately does NOT reuse havdalahDate for the Post-Shabbos
// window -- once Havdalah has actually passed, a fresh dateless Hebcal
// fetch may already flip to referencing *next* week's Shabbos (the same
// fetch this page's own isShabbos check relies on), so "now > havdalahDate"
// stops being reliable exactly when this needs it most. Sunday/Saturday-
// night detection uses plain day-of-week instead (date-fns, same library
// already used for isShabbos), and "has this cycle been started" is judged
// against the most recent real Friday via simple calendar math -- not a
// second Hebcal-based date engine, just Date arithmetic.
function mostRecentFriday(now: Date): Date {
  const d = new Date(now)
  const diff = (d.getDay() + 2) % 7 // days since the most recent Friday (getDay: 0=Sun..6=Sat)
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

type ResetBanner = { type: 'post-shabbos' | 'erev-shabbos'; templateName: string } | null

async function getResetBannerInfo(propertyId: string, candleDate: string | null, isEasternSaturday: boolean, easternHour: number, isEasternSunday: boolean): Promise<ResetBanner> {
  const supabase = await createClient()
  const now = new Date()

  const { data: templates } = await supabase
    .from('task_templates')
    .select('id, template_name')
    .eq('property_id', propertyId)
    .in('template_name', ['Erev Shabbos Prep', 'Post-Shabbos Deep Reset'])

  const erevTemplate = templates?.find((t) => t.template_name === 'Erev Shabbos Prep')
  const postTemplate = templates?.find((t) => t.template_name === 'Post-Shabbos Deep Reset')

  async function startedThisCycle(templateId: string | undefined): Promise<boolean> {
    if (!templateId) return true // no real template row -- don't show a banner pointing at nothing
    const { count } = await supabase
      .from('reset_checklist_progress')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId)
      .gt('updated_at', mostRecentFriday(now).toISOString())
    return (count ?? 0) > 0
  }

  // Post-Shabbos: Saturday night after Havdalah roughly-ish (start of
  // Saturday evening, taken as sundown-adjacent -- real precision isn't
  // critical for a reminder banner) through the end of Sunday.
  if ((isEasternSaturday && easternHour >= 18) || isEasternSunday) {
    if (!(await startedThisCycle(postTemplate?.id))) {
      return { type: 'post-shabbos', templateName: postTemplate!.template_name }
    }
  }

  // Erev Shabbos Prep: 2 days before real candle-lighting through
  // candle-lighting itself (roughly Wednesday/Thursday through Friday).
  if (candleDate) {
    const candle = new Date(candleDate)
    const windowStart = new Date(candle.getTime() - 2 * 24 * 60 * 60 * 1000)
    if (now >= windowStart && now < candle) {
      if (!(await startedThisCycle(erevTemplate?.id))) {
        return { type: 'erev-shabbos', templateName: erevTemplate!.template_name }
      }
    }
  }

  return null
}

function weekBounds(today: Date) {
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startStr: fmt(start), endStr: fmt(end) }
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
    supabase.from('meal_plan_entries').select('plan_date, recipe_id, course, recipes(name, kosher_type)').eq('property_id', propertyId).gte('plan_date', startStr).lte('plan_date', endStr).order('plan_date'),
    supabase.from('inventory_items').select('category, name, current_qty, min_qty, photo_url, reorder_link').eq('property_id', propertyId).order('category'),
    list
      ? supabase.from('shopping_list_items').select('name, category, qty_needed, status, inventory_items(photo_url, reorder_link)').eq('shopping_list_id', list.id).eq('status', 'pending').order('category')
      : Promise.resolve({ data: [] as any[] })
  ])
  return { meals: meals.data || [], inventory: inventory.data || [], shopping: shopping.data || [] }
}

// Actionable replacement for the old "301 meals planned" vanity count —
// "missing" means an ingredient this week's linked recipes need that either
// has no matching inventory item at all, or is linked but sitting at 0.
async function getMissingIngredientCount(propertyId: string, recipeIds: string[]) {
  if (recipeIds.length === 0) return 0
  const supabase = await createClient()
  const { data } = await supabase
    .from('recipe_ingredients')
    .select('name, inventory_item_id, inventory_items(current_qty)')
    .in('recipe_id', recipeIds)
    .eq('ignored_from_inventory', false)

  const missing = new Set<string>()
  for (const ing of data || []) {
    const qty = (ing as any).inventory_items?.current_qty
    if (!ing.inventory_item_id || qty === 0 || qty == null) missing.add(ing.name)
  }
  return missing.size
}

// v1 prep timeline: a single prep_lead_days number per recipe rather than a
// full backwards-scheduling engine — surfaces as a reminder once today falls
// inside that recipe's lead window ahead of its planned date.
async function getPrepReminders(propertyId: string) {
  const supabase = await createClient()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const horizon = format(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

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
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [tasksRes, handoverRes] = await Promise.all([
    supabase
      .from('staff_tasks')
      .select('completed')
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
    tasksDone: tasks.filter((t) => t.completed).length,
    tasksOpen: tasks.filter((t) => !t.completed).length,
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

type PrepAheadReminder = { recipeName: string; planDate: string; prepLeadDays: number | null }

async function getPrepAheadReminders(propertyId: string): Promise<PrepAheadReminder[]> {
  const supabase = await createClient()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const horizon = format(new Date(Date.now() + PREP_AHEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  const { data } = await supabase
    .from('meal_plan_entries')
    .select('plan_date, recipes(name, tags, prep_lead_days)')
    .eq('property_id', propertyId)
    .gte('plan_date', todayStr)
    .lte('plan_date', horizon)

  return (data || [])
    .filter((e: any) => e.recipes?.tags?.includes('freezer-friendly'))
    .map((e: any) => ({
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
  const [{ meals, inventory, shopping }, hebcal, hebrewInfo, prepReminders, propertyName, recipeCount, readiness, userRole, prepAheadReminders, prepAheadEnabled] = await Promise.all([
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
  ])
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager'
  const tehillim = await getTehillim(hebrewInfo.day)
  const missingIngredientCount = await getMissingIngredientCount(
    propertyId,
    meals.map((m: any) => m.recipe_id).filter(Boolean)
  )

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

  // Persistent Halachic Calendar widget (separate from the existing Tools
  // Hub card, which stays as-is): Sefira count + candle-lighting time,
  // shown on Friday or Erev Yom Tov specifically.
  const [omerTitle, isErevYomTov, eruvTavshilin, resetBanner] = await Promise.all([
    getOmerStatus(),
    getIsErevYomTov(easternTomorrowStr),
    getEruvTavshilinBanner(easternTodayStr),
    getResetBannerInfo(propertyId, hebcal.candleDate ?? null, isEasternSaturday, easternHour, isEasternSunday),
  ])
  const showHalachicWidget = isEasternFriday || isErevYomTov

  // Canonical course order (Dip/Kids Platter/Soup/Protein/Starch/Vege/Salad/
  // Dessert-last) applied as a secondary sort after plan_date -- the raw
  // query only orders by date, so entries within the same day previously
  // came back in whatever order Postgres happened to return them.
  const courseOrderIndex = new Map(COURSES.map((c, i) => [c.key, i]))
  const sortedMeals = [...meals].sort((a: any, b: any) => {
    if (a.plan_date !== b.plan_date) return a.plan_date < b.plan_date ? -1 : 1
    return (courseOrderIndex.get(a.course) ?? 99) - (courseOrderIndex.get(b.course) ?? 99)
  })

  // One card per day (its full course lineup underneath) rather than one
  // card per course -- previously every course on the same day rendered as
  // its own separate, identically-dated card.
  const mealsByDay = Object.entries(
    sortedMeals.reduce((acc: Record<string, any[]>, meal: any) => {
      (acc[meal.plan_date] ??= []).push(meal)
      return acc
    }, {})
  )
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }))

  const categories = ['Produce', 'Meat', 'Dairy', 'Pantry', 'Bakery', 'Frozen']
  const shoppingByCat = categories.map(cat => ({
    cat,
    items: shopping.filter(s => s.category?.toLowerCase().includes(cat.toLowerCase()))
  })).filter(g => g.items.length > 0)

  // Dashboard preview only — dedupe by name and drop zero-stock rows (most
  // inventory rows are still zero pending a physical count pass; showing
  // them here would make an "at a glance" tile mostly noise) rather than
  // reflecting every per-location row like the real Inventory page does.
  const seenNames = new Set<string>()
  const inventoryPreview = inventory
    .filter((item: any) => item.current_qty > 0)
    .filter((item: any) => {
      if (seenNames.has(item.name)) return false
      seenNames.add(item.name)
      return true
    })
    .slice(0, 5)

  return (
    <div className={`min-h-screen p-6 font-sans transition-all ${isShabbos ? 'bg-amber-50' : 'bg-cream'}`}>
      <div className={`max-w-7xl mx-auto rounded-[2rem] shadow-xl p-6 transition-all ${isShabbos ? 'bg-amber-50/80 backdrop-blur-sm' : 'bg-white'}`}>
        {/* Header — this page already sits under the property layout's own
            header (logo/property name/avatar), so this local title row only
            needs enough space to read clearly, not a second full header's
            worth of padding. */}
        <div className="flex flex-col gap-1 md:flex-row md:justify-between md:items-center md:gap-0 mb-4">
          <h1 className="text-4xl font-serif text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>Sorted & Stocked</h1>
          <div className="text-xs uppercase tracking-[0.2em] text-charcoal/50">Kosher Household Management</div>
        </div>

        {/* Hebrew Bar - LIVE. This is a single centered stack (date+parsha,
            then candle lighting, then Tehillim), not a left/right split —
            with no width constraint of its own it was stretching to the
            full max-w-7xl dashboard width, leaving short centered text
            swimming in a lot of empty side margin at desktop sizes.
            Constrained instead of adding content just to fill space that
            only exists because the card was wider than it needed to be. */}
        <div className={`max-w-2xl mx-auto rounded-2xl p-4 text-center mb-8 border ${isShabbos ? 'bg-amber-100 border-amber-200' : 'bg-gold-light/25 border-gold-light/40'}`}>
          {propertyName && (
            <p className="font-serif text-lg text-charcoal mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Welcome to the {propertyName} Residence
            </p>
          )}
          <div className="inline-flex items-center gap-3">
            <span className="bg-white px-4 py-1 rounded-full text-sm font-medium text-charcoal">
              <span lang="he" dir="rtl">{hebrewInfo.hebrewText}</span> • {format(now, 'EEEE, MMMM d, yyyy')}
            </span>
            {/* hebcal.parsha (the item's "hebrew" field) already includes the
                word for "Parashat" — no separate English prefix needed, and
                adding one would duplicate it. */}
            {hebcal.parsha && (
              <span lang="he" dir="rtl" className="text-sm text-charcoal/60">
                {hebcal.parsha}
              </span>
            )}
          </div>
          <div className="text-sm mt-2 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 text-charcoal/70">
            <span className="flex items-center gap-1">
              <span aria-hidden="true">🕯️</span> Candle Lighting
            </span>
            <span>
              <bdi dir="ltr">{hebcal.candleTime}</bdi> • Lakewood, NJ
            </span>
            {isShabbos && <span className="px-2 py-0.5 bg-amber-200 rounded-full text-xs">Shabbos Mode Active</span>}
          </div>
          {/* Sefiras HaOmer: only non-null during the real ~49-day Omer
              window (Hebcal itself returns null outside it, so no date-range
              logic is needed here) -- previously only ever shown on Fridays/
              Erev Yom Tov inside the halachic widget below, invisible every
              other day of the count. Persistent here instead, alongside the
              Hebrew date it's most naturally read next to. */}
          {omerTitle && (
            <div className="text-sm mt-2 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full text-charcoal">
              <span aria-hidden="true">🔢</span> {omerTitle}
            </div>
          )}
          {tehillim && (
            <div className="text-sm mt-2 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full text-charcoal">
              <span aria-hidden="true">📖</span> Tehillim: Perek {tehillim.perek_start}
              {tehillim.perek_end !== tehillim.perek_start ? `–${tehillim.perek_end}` : ''}
              {tehillim.note && <span className="text-charcoal/50">({tehillim.note})</span>}
            </div>
          )}
        </div>

        {/* Quick Actions — Plan Meal is the single primary (filled) action;
            planning drives the rest of the workflow, per IA review. Recipe
            creation and meal planning both happen inline on their list pages
            (no dedicated "/new" route exists for either), Scan reuses the
            exact same route as the header/icon nav's Scan link. */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <Link
            href={`/properties/${propertyId}/meal-plan`}
            className="inline-flex items-center gap-2 rounded-full bg-gold-dark text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            <Calendar size={16} aria-hidden="true" /> Plan Meal
          </Link>
          <Link
            href={`/properties/${propertyId}/scan`}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-gold-light/60 text-charcoal px-4 py-2.5 text-sm font-medium hover:bg-gold-light/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
            aria-label="Scan an item"
          >
            <Scan size={16} className="text-gold-dark" aria-hidden="true" /> Scan Item
          </Link>
          <Link
            href={`/properties/${propertyId}/recipes`}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-gold-light/60 text-charcoal px-4 py-2.5 text-sm font-medium hover:bg-gold-light/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            <Plus size={16} className="text-gold-dark" aria-hidden="true" /> Add Recipe
          </Link>
          <Link
            href={`/properties/${propertyId}/shopping-list`}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-gold-light/60 text-charcoal px-4 py-2.5 text-sm font-medium hover:bg-gold-light/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            <ShoppingCart size={16} className="text-gold-dark" aria-hidden="true" /> Shopping List
          </Link>
        </div>

        {isOwnerOrManager && (
          <div className="rounded-2xl p-4 mb-8 bg-white border border-gold-light/40">
            <h2 className="text-sm font-display text-charcoal mb-2 flex items-center gap-1.5">
              <Clock size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> Readiness at a glance
            </h2>
            <p className="text-sm text-charcoal/80">
              {readiness.tasksDone + readiness.tasksOpen === 0 ? (
                'No tasks due today.'
              ) : (
                <>
                  <span className="font-medium">{readiness.tasksDone}</span> task{readiness.tasksDone === 1 ? '' : 's'} done,{' '}
                  <span className={`font-medium ${readiness.tasksOpen > 0 ? 'text-rust' : ''}`}>{readiness.tasksOpen}</span> left today.
                </>
              )}
              {' '}Candle lighting <bdi dir="ltr">{hebcal.candleTime}</bdi>.
            </p>
            <p className="text-sm text-charcoal/60 mt-1">
              {readiness.latestHandover ? (
                <>
                  Last handover{readiness.latestHandover.authorName ? ` (${readiness.latestHandover.authorName})` : ''}: "
                  {readiness.latestHandover.noteText.length > 100
                    ? `${readiness.latestHandover.noteText.slice(0, 100)}…`
                    : readiness.latestHandover.noteText}
                  "
                </>
              ) : (
                'No handover notes yet.'
              )}
            </p>
          </div>
        )}

        {/* Quick-glance overview — real counts (inventory.length and
            meals.length are already fetched above for this exact property/
            week, no extra query needed; recipeCount is one lightweight
            count-only query). Distinct from the "X meals planned this week"
            sentence inside This Week's Meals below: this is a top-of-page
            at-a-glance summary, that's a contextual detail with its own
            "missing ingredients" link — not the same information twice. */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl p-4 bg-white border border-gold-light/40 text-center">
            <Package size={18} strokeWidth={1.5} className="text-gold-dark mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-serif text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>{inventory.length}</div>
            <div className="text-xs text-charcoal/50">Total Inventory</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gold-light/40 text-center">
            <BookOpen size={18} strokeWidth={1.5} className="text-gold-dark mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-serif text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>{recipeCount}</div>
            <div className="text-xs text-charcoal/50">Active Recipes</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gold-light/40 text-center">
            <Calendar size={18} strokeWidth={1.5} className="text-gold-dark mx-auto mb-1" aria-hidden="true" />
            <div className="text-2xl font-serif text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>{meals.length}</div>
            <div className="text-xs text-charcoal/50">Meals Planned</div>
          </div>
        </div>

        {prepReminders.length > 0 && (
          <div className="rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40">
            <h2 className="text-sm font-display text-charcoal mb-2 flex items-center gap-1.5">
              <Clock size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> Prep reminders
            </h2>
            <ul className="space-y-1.5">
              {prepReminders.map((r, i) => (
                <li key={i} className="text-sm text-charcoal/80">
                  <span className="font-medium">{r.recipeName}</span> — start prep{' '}
                  {r.daysUntil === 0 ? 'today' : `by ${format(parseISO(r.planDate), 'EEEE')}`}, needed for{' '}
                  {format(parseISO(r.planDate), 'EEEE, MMM d')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PrepAheadAssistant
          propertyId={propertyId}
          initialEnabled={prepAheadEnabled}
          reminders={prepAheadReminders}
          canManage={isOwnerOrManager}
        />

        {showHalachicWidget && (
          <div className="rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40">
            <h2 className="text-sm font-display text-charcoal mb-2 flex items-center gap-1.5">
              <BookMarked size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> {isErevYomTov ? 'Erev Yom Tov' : 'Erev Shabbos'}
            </h2>
            <p className="text-sm text-charcoal/80">
              {/* Omer count now shown persistently in the Hebrew date card
                  above -- not repeated here to avoid saying it twice on the
                  one day a week both are visible. */}
              Hadlakas Neiros <bdi dir="ltr">{hebcal.candleTime}</bdi>
            </p>
          </div>
        )}

        {eruvTavshilin && (
          <div className="rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40">
            <h2 className="text-sm font-display text-charcoal mb-2 flex items-center gap-1.5">
              <Flame size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> Eruv Tavshilin reminder
            </h2>
            <p className="text-sm text-charcoal/80">
              Make Eruv Tavshilin on <span className="font-medium">{format(parseISO(eruvTavshilin.eruvDate), 'EEEE, MMM d')}</span>, before {eruvTavshilin.name} begins.
            </p>
          </div>
        )}

        {resetBanner && (
          <Link
            href={`/properties/${propertyId}/tools/reset-checklist`}
            className="block rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40 hover:bg-gold-light/25 transition-colors"
          >
            <h2 className="text-sm font-display text-charcoal mb-1 flex items-center gap-1.5">
              <BookMarked size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" />
              {resetBanner.type === 'post-shabbos' ? 'Post-Shabbos reset' : 'Erev Shabbos prep'}
            </h2>
            <p className="text-sm text-charcoal/80">
              {resetBanner.templateName} hasn't been started yet — tap to open the checklist.
            </p>
          </Link>
        )}

        {isMotzeiShabbos && (
          <div className="rounded-2xl p-4 mb-8 bg-gold-light/15 border border-gold-light/40">
            <h2 className="text-sm font-display text-charcoal mb-2 flex items-center gap-1.5">
              <UtensilsCrossed size={16} strokeWidth={1.75} className="text-gold-dark" aria-hidden="true" /> Motzei Shabbos — easy dinner?
            </h2>
            <div className="flex gap-2 flex-wrap">
              {['Pizza', 'Pasta', 'Salad'].map((suggestion) => (
                <span key={suggestion} className="text-sm px-3 py-1.5 bg-white border border-gold-light/40 rounded-full text-charcoal">
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h2 className="text-2xl font-serif flex items-center gap-2 text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>
                <Calendar size={20} strokeWidth={1.5} className="text-gold-dark" aria-hidden="true" /> This Week's Meals
              </h2>
              <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-gold-dark hover:text-charcoal underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">
                View full meal plan →
              </Link>
            </div>
            {/* Actionable stat, replacing the old raw "meals planned" count —
                ties the number to something fixable (missing ingredients)
                rather than just reporting volume. */}
            <p className="text-charcoal/60 mb-4">
              <span className="font-medium text-charcoal">{meals.length}</span> meal{meals.length === 1 ? '' : 's'} planned this week
              {missingIngredientCount > 0 && (
                <>
                  {' '}·{' '}
                  <Link href={`/properties/${propertyId}/shopping-list`} className="text-rust font-medium hover:underline">
                    {missingIngredientCount} ingredient{missingIngredientCount === 1 ? '' : 's'} missing
                  </Link>
                </>
              )}
            </p>

            {/* Legend — color paired with a distinct shape + label, not
                color alone, so it holds up for colorblind users. */}
            <div className="flex gap-2 mb-4 flex-wrap" role="list" aria-label="Kashrut color legend">
              {(Object.entries(KASHRUT_INFO) as [keyof typeof KASHRUT_INFO, typeof KASHRUT_INFO[keyof typeof KASHRUT_INFO]][]).map(([k, info]) => (
                <div key={k} role="listitem" className="flex items-center gap-1.5 px-3 py-1.5 border border-gold-light/40 rounded-full text-xs bg-white text-charcoal">
                  <info.Icon className={`w-3 h-3 ${info.color}`} fill="currentColor" aria-hidden="true" />
                  {k}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {mealsByDay.map(({ date, entries }) => (
                <div key={date} className="p-4 bg-white border border-gold-light/40 rounded-xl">
                  <div className="font-medium text-charcoal mb-2">{format(parseISO(date), 'EEEE • MMM d')}</div>
                  <div className="space-y-1.5">
                    {entries.map((meal: any, i) => {
                      const k = getKashrut(meal.recipes?.kosher_type)
                      const info = KASHRUT_INFO[k]
                      const courseLabel = COURSES.find((c) => c.key === meal.course)?.label
                      return (
                        <div key={i} className="flex items-center gap-2 pl-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-white rounded-md font-medium shrink-0 ${info.bg}`}>
                            <info.Icon className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true" />
                            {k}
                          </span>
                          <span className="text-sm text-charcoal">
                            {courseLabel && <span className="text-charcoal/50">{courseLabel}: </span>}
                            {meal.recipes?.name || 'Meal'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {meals.length === 0 && (
                <p className="text-sm text-charcoal/40 italic py-4">Nothing planned yet this week.</p>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <h2 className="text-2xl font-serif mb-1 flex items-center gap-2 text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>
              <ShoppingBag size={20} strokeWidth={1.5} className="text-gold-dark" aria-hidden="true" /> Shopping List
            </h2>
            <p className="text-sm text-charcoal/50 mb-4">{shopping.length} items</p>

            <div className="space-y-4">
              {shoppingByCat.map(group => (
                <div key={group.cat}>
                  <div className="flex items-center gap-2 font-medium mb-2 text-charcoal/80">
                    <span className={`w-3 h-3 rounded-full ${group.cat === 'Meat' ? 'bg-rust' : group.cat === 'Dairy' ? 'bg-dairy' : 'bg-sage'}`}></span>
                    {group.cat}
                  </div>
                  <div className="space-y-2 ml-5">
                    {group.items.map((item: any, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm p-2 bg-white border border-gold-light/30 rounded-lg hover:bg-gold-light/10 transition">
                        <input type="checkbox" className="rounded border-gold-light/60 text-gold-dark" aria-label={`Mark ${item.name} purchased`} />
                        {item.inventory_items?.photo_url && <img src={item.inventory_items.photo_url} alt="" className="w-8 h-8 object-cover rounded" />}
                        <div className="flex-1">
                          <div className="font-medium text-charcoal">{item.name}</div>
                          <div className="text-xs text-charcoal/50">{item.qty_needed}</div>
                        </div>
                        {item.inventory_items?.reorder_link && (
                          <a href={item.inventory_items.reorder_link} target="_blank" rel="noopener noreferrer" className="text-gold-dark hover:text-charcoal text-xs font-medium px-2 py-1 bg-gold-light/20 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">
                            Order ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {shopping.length === 0 && (
                <div className="text-center py-6 border border-dashed border-gold-light/50 rounded-xl">
                  <p className="text-sm text-charcoal/50 mb-3">No items yet — generate from this week's meals.</p>
                  <Link
                    href={`/properties/${propertyId}/shopping-list`}
                    className="inline-block bg-gold-dark text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition"
                  >
                    Go to Shopping List
                  </Link>
                </div>
              )}
            </div>

            <h3 className="text-xl font-serif mt-8 mb-3 flex items-center gap-2 text-charcoal" style={{fontFamily: 'Playfair Display, serif'}}>
              <Package size={20} strokeWidth={1.5} className="text-gold-dark" aria-hidden="true" /> Inventory Items
            </h3>
            <div className="space-y-2">
              {inventoryPreview.map((item: any, i) => {
                const stockPct = item.current_qty > 0 ? Math.min(100, (item.current_qty / (item.min_qty + 2)) * 100) : 0
                const isLow = item.current_qty < item.min_qty
                return (
                  <div key={i} className={`p-3 rounded-lg border ${isLow ? 'bg-rust/10 border-rust/30' : 'bg-white border-gold-light/30'}`}>
                    <div className="flex items-start gap-3">
                      {item.photo_url && <img src={item.photo_url} alt="" className="w-10 h-10 object-cover rounded" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-charcoal truncate">{item.name}</div>
                        <div className="text-xs text-charcoal/50">{item.category}</div>
                        <div className="w-full bg-gold-light/30 h-1 rounded-full mt-1.5 overflow-hidden">
                          <div className={`${isLow ? 'bg-rust' : 'bg-sage'} h-1 transition-all`} style={{ width: `${stockPct}%` }}></div>
                        </div>
                        <div className="text-xs text-charcoal/60 mt-1">Qty: {item.current_qty} {isLow && <span className="text-rust font-medium">LOW</span>}</div>
                      </div>
                      {item.reorder_link && (
                        <a href={item.reorder_link} target="_blank" rel="noopener noreferrer" className="text-gold-dark hover:text-charcoal text-xs font-medium px-2 py-1 bg-gold-light/20 rounded whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">
                          Order ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
              {inventoryPreview.length === 0 && (
                <p className="text-sm text-charcoal/50 text-center py-4">No items yet</p>
              )}
            </div>

            <Link
              href={`/properties/${propertyId}/inventory`}
              className="block w-full mt-4 text-center bg-white border border-gold-light/60 text-charcoal py-3 rounded-xl font-medium hover:bg-gold-light/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
            >
              + Add Item
            </Link>
          </div>
        </div>

        {/* Mobile bottom nav only shows Home/Recipes/Scan/Shopping/Inventory
            — Tools/Staff/Settings are reachable from here instead of being
            crammed into the bottom bar. Labels now lives inside Inventory and
            Handover inside Staff's Handover tab, so neither needs its own
            entry point here anymore. Desktop already has these in the
            nav's "More" dropdown, so this block is mobile-only. */}
        <div className="md:hidden mt-6 pt-4 border-t border-gold-light/30 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href={`/properties/${propertyId}/tools`} className="text-charcoal/60 hover:text-charcoal underline underline-offset-2">
            Tools
          </Link>
          <Link href={`/properties/${propertyId}/staff`} className="text-charcoal/60 hover:text-charcoal underline underline-offset-2">
            Staff
          </Link>
          <Link href={`/properties/${propertyId}/settings`} className="text-charcoal/60 hover:text-charcoal underline underline-offset-2">
            Settings
          </Link>
        </div>

        {isShabbos && (
          // bottom-24 on md+ so this doesn't sit on top of the floating
          // Scan button, which occupies bottom-6 right-6 on desktop only.
          <div className="fixed bottom-4 right-4 md:bottom-24 bg-amber-900 text-amber-50 px-4 py-2 rounded-full text-sm shadow-lg">
            Shabbos Mode • Editing disabled
          </div>
        )}
      </div>
      <FloatingScanButton propertyId={propertyId} />
    </div>
  )
}
