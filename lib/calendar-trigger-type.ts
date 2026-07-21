// lib/calendar-trigger-type.ts
// Single source of truth for calendar_content trigger-type detection --
// used by both the Dashboard's Today card and the Staff (My Day) landing
// page, so the holiday-matching logic only ever exists in one place. The
// Dashboard already fetches most of these signals for its own display
// purposes (Omer text, Rosh Chodesh countdown, etc.), so it imports the
// individual functions below and calls the pure resolveTriggerType() with
// values it already has. Callers that only need the final answer (like the
// Staff page) can call getTodayTriggerType() instead, which does its own
// minimal I/O internally.

export type TriggerType =
  | 'yom_kippur' | 'fast_day' | 'rosh_hashana' | 'pesach' | 'sukkot' | 'shavuot'
  | 'purim' | 'chanukah' | 'nine_days' | 'shabbos' | 'rosh_chodesh' | 'omer'
  | 'pre_yomtov' | 'general'

export type MajorHolidayTrigger = 'yom_kippur' | 'rosh_hashana' | 'pesach' | 'sukkot' | 'shavuot' | 'purim' | 'chanukah'

// Title-prefix matchers against Hebcal's real maj=on/min=on event set.
// Rosh Hashana excludes "Rosh Hashana LaBehemot" (an obscure 1 Elul
// agricultural date some Hebcal configs surface) so it can't fire a
// three-week-early false positive. Purim matches exact titles, not a
// substring check -- "Erev Purim" contains the substring "Purim" too,
// caught by checking real Hebcal 2026 title output before this was trusted.
const HOLIDAY_TITLE_MATCHERS: { type: MajorHolidayTrigger; test: (title: string) => boolean }[] = [
  { type: 'yom_kippur', test: (t) => t.startsWith('Yom Kippur') },
  { type: 'rosh_hashana', test: (t) => t.startsWith('Rosh Hashana') && !t.includes('LaBehemot') },
  { type: 'pesach', test: (t) => t.startsWith('Pesach') },
  { type: 'sukkot', test: (t) => t.startsWith('Sukkot') },
  { type: 'shavuot', test: (t) => t.startsWith('Shavuot') },
  { type: 'purim', test: (t) => t === 'Purim' || t.startsWith('Shushan Purim') },
  { type: 'chanukah', test: (t) => t.startsWith('Chanukah') },
]

export async function getMajorHolidayToday(todayStr: string): Promise<MajorHolidayTrigger | null> {
  try {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    const events: { title: string; date: string }[] = []
    for (const year of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&maj=on&min=on`, {
        next: { revalidate: 3600 * 24 },
      })
      const data = await res.json()
      events.push(...(data.items ?? []))
    }
    const todaysTitles = events.filter((e) => e.date === todayStr).map((e) => e.title)
    for (const matcher of HOLIDAY_TITLE_MATCHERS) {
      if (todaysTitles.some(matcher.test)) return matcher.type
    }
    return null
  } catch {
    return null
  }
}

// The Nine Days (1-9 Av) aren't a discrete Hebcal title/event -- they're a
// Hebrew-date range -- so this reads the /converter endpoint. Day 10
// (Tisha B'Av itself) is deliberately NOT included -- it's already caught
// by the higher-priority fast_day check, which is the intended handoff.
//
// Real bug found and fixed, not assumed, same family as the Candle Lighting
// date bugs found earlier tonight: toISOString() is ALWAYS UTC regardless
// of caller timezone, so on any Eastern evening at/after 8pm (EDT, UTC-4)
// this was already reading TOMORROW's Hebrew date. Anchored to the real
// Eastern calendar date instead, same Intl.DateTimeFormat technique used
// everywhere else in this app.
export async function getIsNineDays(): Promise<boolean> {
  try {
    const eastMap = easternDateParts(new Date())
    const today = `${eastMap.year}-${eastMap.month}-${eastMap.day}`
    const res = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${today}&g2h=1`, { next: { revalidate: 86400 } })
    const data = await res.json()
    return data.hm === 'Av' && typeof data.hd === 'number' && data.hd >= 1 && data.hd <= 9
  } catch {
    return false
  }
}

// Pulls live from Hebcal (SS-208) instead of the fast_days table, which
// only had rows through 2028-01-09 -- past that date this would have
// silently stopped flagging fast days at all, no error, nothing to notice
// until someone realized a fast day slipped by unflagged. mf=on ("Minor
// Fasts") is a real, separate Hebcal flag from min=on ("Minor Holidays");
// confirmed live that min=on alone never returns Tzom Gedaliah, Asara
// B'Tevet, Ta'anit Esther, or Tzom Tammuz at all, only mf=on does.
//
// Matches on Hebcal's own subcat:'fast', not a title string -- more
// robust than text matching (the fast_days table itself has inconsistent
// apostrophe spelling for the same holiday across different years) and
// naturally excludes Yom Kippur (subcat:'major', handled by the separate
// yom_kippur trigger already) with no extra exclusion needed.
//
// Ta'anit Bechorot (Fast of the Firstborn, day before Pesach) is real in
// Hebcal's subcat:'fast' set but deliberately excluded here, same pattern
// as the Rosh Hashana LaBehemot exclusion above -- it's almost always
// exempted via a siyum in practice and isn't in the household's own
// curated fast_days table either. Flagging that judgment call, not
// silently assuming it.
export async function getIsFastDayToday(todayStr: string): Promise<boolean> {
  try {
    const year = Number(todayStr.slice(0, 4))
    const years = [year, year + 1]
    const events: { title: string; date: string; subcat?: string }[] = []
    for (const y of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${y}&maj=on&min=on&mf=on`, {
        next: { revalidate: 3600 * 24 },
      })
      const data = await res.json()
      events.push(...(data.items ?? []))
    }
    return events.some((e) => e.date === todayStr && e.subcat === 'fast' && !e.title.includes('Bechorot'))
  } catch {
    return false
  }
}

// yom_tov_dates isn't property-scoped (shared calendar data) -- a plain
// date match against tomorrow is enough.
export async function getIsErevYomTov(tomorrowStr: string): Promise<boolean> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase.from('yom_tov_dates').select('date').eq('date', tomorrowStr).maybeSingle()
  return !!data
}

// Same real Hebcal omer logic used elsewhere in this app -- fetch-and-filter
// against the o=on category, not a second date-math engine.
//
// Real bug found and fixed, not assumed: both getFullYear()/getMonth() (the
// query params) and toISOString() (the match key) read/format in whatever
// timezone the runtime itself defaults to -- Vercel is UTC, not Eastern --
// so this could fetch the wrong month AND fail to match the right day near
// a month boundary or any Eastern evening. Anchored to the real Eastern
// calendar date throughout, same pattern used everywhere else in this app.
export async function getOmerStatus(): Promise<string | null> {
  try {
    const eastMap = easternDateParts(new Date())
    const res = await fetch(
      `https://www.hebcal.com/hebcal?cfg=json&v=1&year=${eastMap.year}&month=${eastMap.month}&o=on`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const today = `${eastMap.year}-${eastMap.month}-${eastMap.day}`
    const omerItem = data.items?.find((i: any) => i.category === 'omer' && i.date?.startsWith(today))
    return omerItem?.title ?? null
  } catch {
    return null
  }
}

export type RoshChodeshStatus = { isToday: boolean; monthName: string; daysUntil: number } | null

const ROSH_CHODESH_LOOKAHEAD_DAYS = 5

// Same nx=on Hebcal query/category Hebcal itself uses for Rosh Chodesh.
export async function getRoshChodeshStatus(todayStr: string): Promise<RoshChodeshStatus> {
  try {
    const now = new Date()
    const years = [now.getFullYear(), now.getFullYear() + 1]
    const events: { title: string; date: string }[] = []
    for (const year of years) {
      const res = await fetch(`https://www.hebcal.com/hebcal?cfg=json&v=1&year=${year}&nx=on`, {
        next: { revalidate: 3600 * 24 },
      })
      const data = await res.json()
      events.push(...(data.items ?? []).filter((i: any) => i.category === 'roshchodesh'))
    }
    const monthNameOf = (title: string) => title.replace(/^Rosh Chodesh /, '')
    const todayItem = events.find((e) => e.date === todayStr)
    if (todayItem) {
      return { isToday: true, monthName: monthNameOf(todayItem.title), daysUntil: 0 }
    }
    const next = events.filter((e) => e.date > todayStr).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (!next) return null
    const daysUntil = Math.round((new Date(next.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil > ROSH_CHODESH_LOOKAHEAD_DAYS) return null
    return { isToday: false, monthName: monthNameOf(next.title), daysUntil }
  } catch {
    return null
  }
}

// Priority order per spec: yom_kippur > fast_day > rosh_hashana > pesach >
// sukkot > shavuot > purim > chanukah > nine_days > shabbos > rosh_chodesh >
// omer > pre_yomtov > general. yom_kippur is checked ahead of fast_day on
// purpose -- Yom Kippur IS a fast day, but should read as the Yom Tov
// itself, not the generic fast-day trigger.
export function resolveTriggerType(inputs: {
  majorHolidayToday: MajorHolidayTrigger | null
  isFastDayToday: boolean
  isNineDaysToday: boolean
  isShabbos: boolean
  roshChodeshToday: boolean
  omerTitle: string | null
  isErevYomTov: boolean
}): TriggerType {
  const { majorHolidayToday, isFastDayToday, isNineDaysToday, isShabbos, roshChodeshToday, omerTitle, isErevYomTov } = inputs
  if (majorHolidayToday === 'yom_kippur') return 'yom_kippur'
  if (isFastDayToday) return 'fast_day'
  if (majorHolidayToday === 'rosh_hashana') return 'rosh_hashana'
  if (majorHolidayToday === 'pesach') return 'pesach'
  if (majorHolidayToday === 'sukkot') return 'sukkot'
  if (majorHolidayToday === 'shavuot') return 'shavuot'
  if (majorHolidayToday === 'purim') return 'purim'
  if (majorHolidayToday === 'chanukah') return 'chanukah'
  if (isNineDaysToday) return 'nine_days'
  if (isShabbos) return 'shabbos'
  if (roshChodeshToday) return 'rosh_chodesh'
  if (omerTitle) return 'omer'
  if (isErevYomTov) return 'pre_yomtov'
  return 'general'
}

function easternDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

// Convenience all-in-one for callers that only need the final resolved
// type, not each individual signal (e.g. the Staff landing page, which
// doesn't otherwise fetch any Hebcal data). Internally calls the exact same
// functions above plus its own minimal candle/havdalah check for Shabbos --
// this comment used to claim that meant it "can never disagree with the
// Dashboard's own computation of the same day," but that was never actually
// true: this is a separate, independent fetch, not a shared call, and it
// carried neither of the two real bugs already found and fixed in the
// Dashboard's own getHebcal() -- (1) a dateless /shabbat query returns
// Hebcal's own implicit "today," not real wall-clock time, and (2) even
// with an explicit date, gy/gm/gd has no time-of-day, so it keeps returning
// the just-ended Shabbos for the several hours between real Havdalah and
// real midnight. Confirmed live tonight: this exact duplication meant the
// Staff My Day notice banner (the only caller of this function) could still
// show stale Shabbos-related content on a real Sunday even after the
// Dashboard's own version was fixed, since they were never actually the
// same code. Fixed here with the identical two-part fix, reusing the
// Eastern date parts already computed below instead of re-deriving them.
export async function getTodayTriggerType(): Promise<TriggerType> {
  const now = new Date()
  const partsMap = easternDateParts(now)
  const isEasternFriday = partsMap.weekday === 'Fri'
  const isEasternSaturday = partsMap.weekday === 'Sat'
  const todayUTC = Date.UTC(
    parseInt(partsMap.year ?? '1970', 10),
    parseInt(partsMap.month ?? '1', 10) - 1,
    parseInt(partsMap.day ?? '1', 10)
  )
  const todayDate = new Date(todayUTC)
  const todayStr = `${todayDate.getUTCFullYear()}-${String(todayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(todayDate.getUTCDate()).padStart(2, '0')}`
  const tomorrowDate = new Date(todayUTC + 24 * 60 * 60 * 1000)
  const tomorrowStr = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`

  let isShabbos = false
  try {
    const fetchShabbat = async (y: number | string, m: number | string, d: number | string) => {
      const res = await fetch(
        `https://www.hebcal.com/shabbat?cfg=json&geonameid=5100280&M=on&gy=${y}&gm=${m}&gd=${d}`,
        { next: { revalidate: 86400 } }
      )
      const data = await res.json()
      return {
        candle: data.items?.find((i: any) => i.category === 'candles'),
        havdalah: data.items?.find((i: any) => i.category === 'havdalah'),
      }
    }
    let { candle, havdalah } = await fetchShabbat(partsMap.year, partsMap.month, partsMap.day)
    if (havdalah && now > new Date(havdalah.date)) {
      ;({ candle, havdalah } = await fetchShabbat(
        tomorrowDate.getUTCFullYear(),
        tomorrowDate.getUTCMonth() + 1,
        tomorrowDate.getUTCDate()
      ))
    }
    isShabbos = !!(
      (isEasternFriday && candle?.date && now > new Date(new Date(candle.date).getTime() - 3600000)) ||
      (isEasternSaturday && havdalah?.date && now < new Date(havdalah.date))
    )
  } catch {
    // leave isShabbos false
  }

  const [majorHolidayToday, isFastDayToday, isNineDaysToday, roshChodeshStatus, omerTitle, isErevYomTov] = await Promise.all([
    getMajorHolidayToday(todayStr),
    getIsFastDayToday(todayStr),
    getIsNineDays(),
    getRoshChodeshStatus(todayStr),
    getOmerStatus(),
    getIsErevYomTov(tomorrowStr),
  ])

  return resolveTriggerType({
    majorHolidayToday,
    isFastDayToday,
    isNineDaysToday,
    isShabbos,
    roshChodeshToday: !!roshChodeshStatus?.isToday,
    omerTitle,
    isErevYomTov,
  })
}
