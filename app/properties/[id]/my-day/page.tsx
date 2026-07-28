// app/properties/[id]/my-day/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';
import MyDayClient from '@/components/MyDayClient';
import { getTodayTriggerType } from '@/lib/calendar-trigger-type';

// general/omer are deliberately excluded, not just "usually have no note" --
// per spec, this banner never shows on those two days even if a future
// content edit accidentally adds a staff_note to a general/omer row.
async function getStaffNote(propertyId: string, triggerType: string): Promise<{ en: string; es: string | null } | null> {
  if (triggerType === 'general' || triggerType === 'omer') return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('calendar_content')
    .select('staff_note_en, staff_note_es')
    .eq('property_id', propertyId)
    .eq('trigger_type', triggerType)
    .eq('active', true)
    .not('staff_note_en', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!data?.staff_note_en) return null
  return { en: data.staff_note_en, es: data.staff_note_es }
}

// Lakewood/Eastern-time parts, same construction as dashboard/page.tsx and
// lib/calendar-trigger-type.ts's own (unexported) easternDateParts -- not
// reused from there since that module's exports are all calendar_content
// trigger-type logic, not a general-purpose date utility, and this is the
// only caller needing an ISO weekday + coarse AM/PM block rather than a
// weekday name.
function eastern(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const todayStr = `${map.year}-${map.month}-${map.day}`
  const hour = parseInt(map.hour ?? '0', 10)
  // ISO 8601 weekday: 1=Monday..7=Sunday. Intl's weekday short names mapped
  // directly rather than deriving from JS Date.getDay() (0=Sunday), since
  // the Intl parts are already the real Eastern-local day regardless of
  // what timezone the server process itself runs in.
  const isoWeekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[map.weekday as string] ?? 1
  const timeBlock: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM'
  return { todayStr, isoWeekday, timeBlock }
}

type DutyTask = { id: string; taskEn: string; taskEs: string; completed: boolean }
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] }

// SS-242: master_tasks is the source of truth for staff work, reached through
// task_assignments. This previously read staff_duty_templates -- 61 rows on
// Main, 0 on Lax, 0 on Country -- which is why My Day was empty for every
// staff member on every property. master_tasks carries 96 on Main and 78 on
// Lax, is bilingual on every row, and is what the restricted tasks_read policy
// already keys on.
//
// Assignment, not roster key, is what makes a task "mine": task_assignments
// respects `active` and the effective_from/effective_to window, so a duty
// that ended yesterday stops appearing without anything being deleted.
async function getDutyAreas(
  propertyId: string,
  memberId: string,
  todayStr: string,
  isoWeekday: number,
  timeBlock: 'AM' | 'PM'
): Promise<DutyArea[]> {
  const supabase = await createClient()

  // Errors are logged, never silently returned as an empty list. The RLS
  // recursion on 27 Jul made this concrete: the Duty Roster reported "Some
  // duties could not be loaded" while this page said "Nothing due right now"
  // for the same failure -- one told the truth, one invented an answer. A
  // query that FAILED must not be indistinguishable from one that found
  // nothing.
  const { data: assignments, error: assignErr } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('member_id', memberId)
    .eq('active', true)
    .lte('effective_from', todayStr)
    .or(`effective_to.is.null,effective_to.gte.${todayStr}`)
  if (assignErr) console.error('my-day: task_assignments fetch failed', assignErr)
  const assignedIds = (assignments ?? []).map((a) => a.task_id).filter(Boolean)
  if (assignedIds.length === 0) return []

  const { data: tasks, error: tasksErr } = await supabase
    .from('master_tasks')
    .select('id, task_en, task_es, source_area_en, source_area_es, sort_order')
    .eq('property_id', propertyId)
    .eq('active', true)
    .in('id', assignedIds)
    // day_of_week and time_of_day are null on almost every row, so a strict
    // equality filter would hide nearly everything. Null means "any day/any
    // time", which is the common case.
    .or(`day_of_week.is.null,day_of_week.eq.${isoWeekday}`)
    .or(`time_of_day.is.null,time_of_day.eq.${timeBlock}`)
    .order('sort_order')
  if (tasksErr) console.error('my-day: master_tasks fetch failed', tasksErr)
  if (!tasks || tasks.length === 0) return []

  const ids = tasks.map((t) => t.id)
  const { data: completions, error: complErr } = await supabase
    .from('task_completions')
    .select('task_id, completed')
    .eq('due_date', todayStr)
    .in('task_id', ids)
  // A completions failure is the mildest of the three: tasks still render,
  // they just all read as not-done. Logged so it is diagnosable rather than
  // looking like nobody did any work today.
  if (complErr) console.error('my-day: task_completions fetch failed', complErr)
  const completedSet = new Set((completions ?? []).filter((c) => c.completed).map((c) => c.task_id))

  // source_area_en/_es are the bilingual area labels already on master_tasks.
  // Grouping by room was the alternative and would collapse to one bucket --
  // most tasks still have no room_id.
  const areas: DutyArea[] = []
  const areaIndex = new Map<string, number>()
  for (const t of tasks) {
    const areaEn = t.source_area_en ?? 'General'
    const areaEs = t.source_area_es ?? 'General'
    let idx = areaIndex.get(areaEn)
    if (idx === undefined) {
      idx = areas.length
      areaIndex.set(areaEn, idx)
      areas.push({ areaEn, areaEs, tasks: [] })
    }
    areas[idx].tasks.push({ id: t.id, taskEn: t.task_en, taskEs: t.task_es, completed: completedSet.has(t.id) })
  }
  return areas
}

export default async function MyDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Same shared trigger-type resolution the Dashboard's Today card uses
  // (lib/calendar-trigger-type.ts) -- one priority chain, so this page can
  // never disagree with the Dashboard about what today "is."
  const [locale, triggerType] = await Promise.all([getLocale(), getTodayTriggerType()]);
  const note = await getStaffNote(id, triggerType);
  const staffNote = note ? (locale === 'es' && note.es ? note.es : note.en) : null;

  // The duty checklist is gated to role === 'staff' specifically (unlike
  // the rest of this page, which per the comment below has never been
  // staff-exclusive) -- an owner/manager visiting /my-day directly sees
  // everything else on the page unchanged, just not this section. Real
  // staff_roster_key value pulled here (not just role) since the checklist
  // itself needs to distinguish "staff with no roster assigned yet" from
  // "staff whose roster has nothing due right now" -- two different empty
  // states worth telling apart, not one generic "nothing here."
  const { data: membership } = await supabase
    .from('property_members')
    .select('id, role, staff_roster_key')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let dutyAreas: DutyArea[] = [];
  const isStaff = membership?.role === 'staff';
  const hasRosterKey = !!membership?.staff_roster_key;
  const { todayStr, isoWeekday, timeBlock } = eastern(new Date());
  // Gated on having a membership row, not on role or roster key. Assignment is
  // now what makes a task yours (SS-242), and an owner or manager can be
  // assigned one too -- they simply usually have none. Keeping the old
  // isStaff && hasRosterKey gate here would have left My Day empty for exactly
  // the people the repoint was meant to fix.
  if (membership?.id) {
    dutyAreas = await getDutyAreas(id, membership.id, todayStr, isoWeekday, timeBlock);
  }

  // Parent layout already confirmed membership on this property — no
  // additional role gate here. This is staff's landing page, but nothing
  // about it is staff-exclusive (an owner/manager visiting directly just
  // sees their own assigned tasks, which may be none).
  return (
    <MyDayClient
      propertyId={id}
      staffNote={staffNote}
      isStaff={isStaff}
      hasRosterKey={hasRosterKey}
      dutyAreas={dutyAreas}
      todayStr={todayStr}
    />
  );
}
