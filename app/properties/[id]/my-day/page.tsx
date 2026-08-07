// app/properties/[id]/my-day/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';
import MyDayClient from '@/components/MyDayClient';
import { getTodayTriggerType, getRoshChodeshStatus } from '@/lib/calendar-trigger-type';
import { getPhotolessCount } from '@/lib/photo-worklist-count';
import { signSopPosters } from '@/lib/sop-posters';

// general/omer are deliberately excluded, not just "usually have no note" --
// per spec, this banner never shows on those two days even if a future
// content edit accidentally adds a staff_note to a general/omer row.
//
// SS-065: same bug as the Dashboard's getDailyContent had (calendar_content
// carries a real hebrew_month-tagged row for most months -- 13 currently
// have a staff_note_en set, not a placeholder handful), so a plain
// trigger_type match on 'rosh_chodesh' with no month filter and .limit(1)
// could surface any month's note on any Rosh Chodesh, not necessarily
// today's. hebrewMonth is only passed for rosh_chodesh, and only when
// today genuinely IS Rosh Chodesh (see call site).
async function getStaffNote(
  propertyId: string,
  triggerType: string,
  hebrewMonth: string | null
): Promise<{ en: string; es: string | null } | null> {
  if (triggerType === 'general' || triggerType === 'omer') return null
  const supabase = await createClient()
  const base = () =>
    supabase
      .from('calendar_content')
      .select('staff_note_en, staff_note_es')
      .eq('property_id', propertyId)
      .eq('trigger_type', triggerType)
      .eq('active', true)
      .not('staff_note_en', 'is', null)

  let data: { staff_note_en: string; staff_note_es: string | null } | null = null
  if (triggerType === 'rosh_chodesh' && hebrewMonth) {
    ;({ data } = await base().eq('hebrew_month', hebrewMonth).limit(1).maybeSingle())
    if (!data) {
      ;({ data } = await base().is('hebrew_month', null).limit(1).maybeSingle())
    }
  } else {
    ;({ data } = await base().limit(1).maybeSingle())
  }
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

// SS-850 ruling: the task's own photo is first; the procedure (text, then
// poster) shows second, in the body; the video that teaches it renders
// alongside. Nobody leaves a task to find out how to do it -- so all four
// travel on the DutyTask itself rather than requiring a second fetch from
// the client.
type DutyTask = {
  id: string
  taskEn: string
  taskEs: string
  completed: boolean
  photoUrl: string | null
  procedureEn: string | null
  procedureEs: string | null
  posterUrl: string | null
  videoTitleEn: string | null
  videoTitleEs: string | null
  videoUrl: string | null
  videoPosterUrl: string | null
}
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
  userId: string,
  todayStr: string,
  isoWeekday: number,
  timeBlock: 'AM' | 'PM'
): Promise<DutyArea[]> {
  const supabase = await createClient()

  // SS-429 B: a task is "mine" through either link -- a direct member_id
  // assignment, or an assignment to a staff slot whose user_id is me. The
  // slot lookup happens first because PostgREST's or() needs the concrete
  // slot ids; a viewer with no linked slot skips straight to the member
  // filter unchanged.
  const { data: mySlots } = await supabase
    .from('staff_slots')
    .select('id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
  const slotIds = (mySlots ?? []).map((s) => s.id)

  // Errors are logged, never silently returned as an empty list. The RLS
  // recursion on 27 Jul made this concrete: the Duty Roster reported "Some
  // duties could not be loaded" while this page said "Nothing due right now"
  // for the same failure -- one told the truth, one invented an answer. A
  // query that FAILED must not be indistinguishable from one that found
  // nothing.
  let assignmentsQuery = supabase
    .from('task_assignments')
    .select('task_id')
    .eq('active', true)
    .lte('effective_from', todayStr)
    .or(`effective_to.is.null,effective_to.gte.${todayStr}`)
  assignmentsQuery = slotIds.length > 0
    ? assignmentsQuery.or(`member_id.eq.${memberId},slot_id.in.(${slotIds.join(',')})`)
    : assignmentsQuery.eq('member_id', memberId)
  const { data: assignments, error: assignErr } = await assignmentsQuery
  if (assignErr) console.error('my-day: task_assignments fetch failed', assignErr)
  const assignedIds = (assignments ?? []).map((a) => a.task_id).filter(Boolean)
  if (assignedIds.length === 0) return []

  const { data: tasks, error: tasksErr } = await supabase
    .from('master_tasks')
    .select('id, task_en, task_es, source_area_en, source_area_es, sort_order, photo_url')
    .eq('property_id', propertyId)
    .eq('active', true)
    .in('id', assignedIds)
    // SS-772. READS days_of_week, THE ARRAY -- not the day_of_week scalar.
    //
    // This is the contract half of migration 191's expand/contract, and it
    // was the whole reason My Day looked unaffected by scheduling work:
    // every day Racquel set went into days_of_week (122 rows live), while
    // this query filtered day_of_week (4 rows). The page was reading a
    // column nobody writes.
    //
    // `cs` is PostgREST array containment, so a task carrying [1,4] matches
    // both Monday and Thursday. The scalar could not express that at all --
    // it is why T-00997/T-00998 exist as two rows for one duty.
    //
    // NULL still means "any day", exactly as the scalar did and exactly as
    // 191's column comment states, so this is a like-for-like swap of the
    // column and not a change to what an unscheduled task does. That also
    // means the 245 longer-than-weekly tasks still surface EVERY day once
    // assigned: a weekday cannot express "every 90 days", and giving them a
    // real due model is its own build (SS-773), deliberately not bundled.
    //
    // day_of_week is left in place and still populated -- deprecated, never
    // dropped (R21). StaffDutyOverview and DutyRosterClient's save path are
    // the remaining scalar readers.
    .or(`days_of_week.is.null,days_of_week.cs.{${isoWeekday}}`)
    .or(`time_of_day.is.null,time_of_day.eq.${timeBlock}`)
    .order('sort_order')
  if (tasksErr) console.error('my-day: master_tasks fetch failed', tasksErr)
  if (!tasks || tasks.length === 0) return []

  const ids = tasks.map((t) => t.id)

  // SS-850 SUPERSEDES SS-517: master_tasks.sop_id is deprecated. Read the
  // real join, primary row only -- 953 legacy values that never made it
  // into master_task_sops now backfilled to zero, per the migration
  // Claude ran 7 Aug.
  const { data: sopLinks, error: sopErr } = await supabase
    .from('master_task_sops')
    .select('master_task_id, sop_library(id, sop_en, sop_es, expected_appearance_url)')
    .in('master_task_id', ids)
    .eq('is_primary', true)
  if (sopErr) console.error('my-day: master_task_sops fetch failed', sopErr)

  type SopEmbed = { id: string; sop_en: string | null; sop_es: string | null; expected_appearance_url: string | null } | null
  const procedureByTask = new Map<string, { sopId: string; en: string | null; es: string | null; poster: string | null }>()
  for (const r of (sopLinks ?? []) as unknown as { master_task_id: string; sop_library: SopEmbed | SopEmbed[] }[]) {
    const embed = Array.isArray(r.sop_library) ? r.sop_library[0] ?? null : r.sop_library
    if (!embed) continue
    procedureByTask.set(r.master_task_id, { sopId: embed.id, en: embed.sop_en, es: embed.sop_es, poster: embed.expected_appearance_url })
  }

  const sopIds = [...new Set([...procedureByTask.values()].map((p) => p.sopId))]
  // The 8 curriculum-level videos (7 app tutorials + 1 marketing promo)
  // carry no sop_id and are correctly excluded by this filter -- per her
  // explicit ruling, they must never attach to a procedure.
  const { data: videoRows } = sopIds.length
    ? await supabase
        .from('training_videos')
        .select('sop_id, title_en, title_es, bucket, storage_path, poster_path')
        .in('sop_id', sopIds)
        .eq('active', true)
    : { data: [] as { sop_id: string | null; title_en: string; title_es: string | null; bucket: string; storage_path: string; poster_path: string | null }[] }

  // One signing pass for everything the checklist can show: task photos,
  // SOP posters (same private sop-posters bucket, lib/sop-posters.ts) and
  // videos (their own bucket(s), same per-bucket pattern
  // lib/training-videos.ts already uses).
  const posterUrls = [...procedureByTask.values()].map((p) => p.poster).filter((u): u is string => !!u)
  const photoUrls = tasks.map((t) => t.photo_url).filter((u): u is string => !!u)
  const signedPosters = await signSopPosters(supabase, [...photoUrls, ...posterUrls])

  const videoByBucket = new Map<string, string[]>()
  for (const v of videoRows ?? []) {
    const paths = videoByBucket.get(v.bucket) ?? []
    paths.push(v.storage_path)
    if (v.poster_path) paths.push(v.poster_path)
    videoByBucket.set(v.bucket, paths)
  }
  const signedVideoUrls = new Map<string, string>()
  await Promise.all(
    [...videoByBucket.entries()].map(async ([bucket, paths]) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600)
      for (const s of data ?? []) {
        if (s.path && s.signedUrl) signedVideoUrls.set(`${bucket}/${s.path}`, s.signedUrl)
      }
    })
  )
  const videoBySopId = new Map<string, { titleEn: string; titleEs: string | null; url: string | null; poster: string | null }>()
  for (const v of videoRows ?? []) {
    if (!v.sop_id || videoBySopId.has(v.sop_id)) continue
    videoBySopId.set(v.sop_id, {
      titleEn: v.title_en,
      titleEs: v.title_es,
      url: signedVideoUrls.get(`${v.bucket}/${v.storage_path}`) ?? null,
      poster: v.poster_path ? signedVideoUrls.get(`${v.bucket}/${v.poster_path}`) ?? null : null,
    })
  }
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
    const procedure = procedureByTask.get(t.id)
    const video = procedure ? videoBySopId.get(procedure.sopId) : undefined
    const rawPhoto = t.photo_url
    const signedPhoto = rawPhoto ? signedPosters.get(rawPhoto)?.fullUrl ?? rawPhoto : null
    const rawPoster = procedure?.poster ?? null
    const signedPoster = rawPoster ? signedPosters.get(rawPoster)?.fullUrl ?? rawPoster : null
    areas[idx].tasks.push({
      id: t.id,
      taskEn: t.task_en,
      taskEs: t.task_es,
      completed: completedSet.has(t.id),
      photoUrl: signedPhoto,
      procedureEn: procedure?.en ?? null,
      procedureEs: procedure?.es ?? null,
      posterUrl: signedPoster,
      videoTitleEn: video?.titleEn ?? null,
      videoTitleEs: video?.titleEs ?? null,
      videoUrl: video?.url ?? null,
      videoPosterUrl: video?.poster ?? null,
    })
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
  // Only fetched on a Rosh Chodesh day (rare) -- getTodayTriggerType() only
  // returns the trigger name, not the month, so this is a second Hebcal
  // call, not a spare value from the first.
  const hebrewMonth =
    triggerType === 'rosh_chodesh'
      ? (await getRoshChodeshStatus(eastern(new Date()).todayStr))?.monthName ?? null
      : null;
  const note = await getStaffNote(id, triggerType, hebrewMonth);
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
    dutyAreas = await getDutyAreas(id, membership.id, user.id, todayStr, isoWeekday, timeBlock);
  }

  // ONE Task Center ruling: staff_tasks stays the ad-hoc one-off lane and
  // ALSO flows into My Day -- but only rows explicitly assigned to the
  // viewer (assigned_to -> their own property_members row) and not done,
  // matching the "nothing appears here that isn't an assignment" rule the
  // canonical master_tasks -> task_assignments path already enforces.
  let adHocTasks: { id: string; title: string; due_date: string | null; priority: string | null }[] = [];
  if (membership?.id) {
    const { data: adHoc, error: adHocErr } = await supabase
      .from('staff_tasks')
      .select('id, title, due_date, priority')
      .eq('property_id', id)
      .eq('assigned_to', membership.id)
      .neq('status', 'done')
      .order('due_date', { ascending: true });
    if (adHocErr) console.error('my-day: staff_tasks fetch failed', adHocErr);
    adHocTasks = adHoc ?? [];
  }

  // SS-869 part 3: My Day's own entry point to the Photo Worklist -- only
  // fetched for owner/manager, matching the worklist page's own access
  // tier (staff are redirected out there, so showing this to them would
  // be a dead click, not an addition).
  const photolessCount = isStaff ? 0 : await getPhotolessCount(supabase, id);

  // Parent layout already confirmed membership on this property — no
  // additional role gate here. This is staff's landing page, but nothing
  // about it is staff-exclusive (an owner/manager visiting directly just
  // sees their own assigned tasks, which may be none).
  // SS-857: stamped after every read above.
  return (
    <MyDayClient
      propertyId={id}
      staffNote={staffNote}
      isStaff={isStaff}
      hasRosterKey={hasRosterKey}
      dutyAreas={dutyAreas}
      adHocTasks={adHocTasks}
      todayStr={todayStr}
      readAt={new Date().toISOString()}
      photolessCount={photolessCount}
    />
  );
}
