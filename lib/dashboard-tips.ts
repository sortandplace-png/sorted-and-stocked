// lib/dashboard-tips.ts
// SS-408: tip-of-the-day selection. The dashboard_tips table (149 bilingual
// tips) is the content; properties.tip_sets (text[] of audiences --
// 'jewish' / 'universal') decides which sets a house sees: Henderson
// {universal}, Lax {universal,jewish}, Main/Country/Low {jewish}.
//
// Calendar-awareness leans ENTIRELY on lib/calendar-trigger-type.ts
// (R1: Hebcal-computed, never stored) -- this file adds no second date
// engine. Jewish special-day triggers outrank universal dated ones, which
// outrank seasonal windows, which outrank the evergreen filler pool.
//
// The pick is DETERMINISTIC per (property, Eastern calendar day): everyone
// in the house sees the same tip all day, and it rotates tomorrow.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTodayTriggerType, type TriggerType } from '@/lib/calendar-trigger-type';

export type DashboardTip = {
  id: string;
  trigger_type: string;
  title_en: string | null;
  title_es: string | null;
  body_en: string | null;
  body_es: string | null;
  audience: string;
};

// Resolver types with no tip rows of their own borrow the nearest set
// before falling through to general (e.g. Shmini Atzeret reads the Sukkot
// cluster's tips; Pesach/Shavuot/Purim/Omer days have no dedicated rows
// yet, so pre_yomtov/general carry them).
const JEWISH_FALLBACKS: Partial<Record<TriggerType, string[]>> = {
  yom_kippur: ['yom_kippur', 'fast_day'],
  fast_day: ['fast_day'],
  rosh_hashana: ['rosh_hashana', 'pre_yomtov'],
  pesach: ['pre_yomtov'],
  sukkot: ['sukkot', 'pre_yomtov'],
  shmini_atzeret: ['sukkot', 'pre_yomtov'],
  simchat_torah: ['sukkot', 'pre_yomtov'],
  shavuot: ['pre_yomtov'],
  purim: ['pre_yomtov'],
  chanukah: ['chanukah'],
  nine_days: ['nine_days', 'fast_day'],
  shabbos: ['shabbos'],
  rosh_chodesh: ['rosh_chodesh'],
  omer: [],
  pre_yomtov: ['pre_yomtov'],
  general: [],
};

function easternParts(): { month: number; day: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { month: Number(get('month')), day: Number(get('day')), weekday: get('weekday') };
}

function easternDateStr(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

/** Universal dated/seasonal triggers, most specific first. */
function universalTriggers(): string[] {
  const { month, day, weekday } = easternParts();
  const out: string[] = [];
  if (day === 1) out.push('monthly_reset');
  if (weekday === 'Thu' || weekday === 'Fri') out.push('weekly_reset');
  if (month === 12) out.push('winter_holiday');
  if (month === 11 || month === 12) out.push('gifting_season');
  if (month === 3 || month === 4) out.push('spring_cleaning');
  if (month >= 6 && month <= 8) out.push('outdoor_season');
  if (month === 9 || month === 10) out.push('fall_holiday');
  return out;
}

// Small deterministic hash -- rotation, not cryptography.
function seedIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return len > 0 ? h % len : 0;
}

export async function getTipOfTheDay(
  supabase: SupabaseClient,
  propertyId: string,
  tipSets: string[]
): Promise<DashboardTip | null> {
  if (!tipSets || tipSets.length === 0) return null;

  const { data } = await supabase
    .from('dashboard_tips')
    .select('id, trigger_type, title_en, title_es, body_en, body_es, audience')
    .eq('status', 'active')
    .in('audience', tipSets);
  const tips = (data ?? []) as DashboardTip[];
  if (tips.length === 0) return null;

  const byTrigger = new Map<string, DashboardTip[]>();
  for (const t of tips) {
    const list = byTrigger.get(t.trigger_type) ?? [];
    list.push(t);
    byTrigger.set(t.trigger_type, list);
  }

  // Priority: jewish resolved special day > universal dated/seasonal >
  // evergreen filler from every remaining type.
  const orderedTriggers: string[] = [];
  if (tipSets.includes('jewish')) {
    const resolved = await getTodayTriggerType();
    if (resolved !== 'general') orderedTriggers.push(...(JEWISH_FALLBACKS[resolved] ?? []));
  }
  if (tipSets.includes('universal')) orderedTriggers.push(...universalTriggers());

  const seed = `${easternDateStr()}:${propertyId}`;
  for (const trigger of orderedTriggers) {
    const candidates = byTrigger.get(trigger);
    if (candidates?.length) return candidates[seedIndex(seed, candidates.length)];
  }

  // Filler: general plus the evergreen types with no date of their own.
  const filler = tips.filter((t) =>
    ['general', 'growth', 'kitchen', 'organization', 'reflective_pause', 'kids'].includes(t.trigger_type)
  );
  const pool = filler.length ? filler : tips;
  return pool[seedIndex(seed, pool.length)];
}
