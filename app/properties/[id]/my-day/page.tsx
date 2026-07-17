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

// RLS on staff_duty_templates/staff_duty_completions already scopes every
// row to the caller's own staff_roster_key (or lets owner/manager see
// everything) -- see policies staff_duty_templates_select and
// staff_duty_completions_select/insert/update, both keyed off
// property_members.staff_roster_key for auth.uid(). No client-side
// staff_roster_key filter added here on top of that; querying "for this
// property, today's applicable day/time" is already "my tasks" once RLS
// has run.
async function getDutyAreas(propertyId: string, todayStr: string, isoWeekday: number, timeBlock: 'AM' | 'PM'): Promise<DutyArea[]> {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('staff_duty_templates')
    .select('id, area_en, area_es, task_en, task_es, sort_order')
    .eq('property_id', propertyId)
    .or(`day_of_week.is.null,day_of_week.eq.${isoWeekday}`)
    .or(`time_of_day.is.null,time_of_day.eq.${timeBlock}`)
    .order('sort_order')
  if (!templates || templates.length === 0) return []

  const ids = templates.map((t) => t.id)
  const { data: completions } = await supabase
    .from('staff_duty_completions')
    .select('template_id, completed')
    .eq('duty_date', todayStr)
    .in('template_id', ids)
  const completedSet = new Set((completions ?? []).filter((c) => c.completed).map((c) => c.template_id))

  const areas: DutyArea[] = []
  const areaIndex = new Map<string, number>()
  for (const t of templates) {
    let idx = areaIndex.get(t.area_en)
    if (idx === undefined) {
      idx = areas.length
      areaIndex.set(t.area_en, idx)
      areas.push({ areaEn: t.area_en, areaEs: t.area_es, tasks: [] })
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
    .select('role, staff_roster_key')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let dutyAreas: DutyArea[] = [];
  const isStaff = membership?.role === 'staff';
  const hasRosterKey = !!membership?.staff_roster_key;
  const { todayStr, isoWeekday, timeBlock } = eastern(new Date());
  if (isStaff && hasRosterKey) {
    dutyAreas = await getDutyAreas(id, todayStr, isoWeekday, timeBlock);
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
