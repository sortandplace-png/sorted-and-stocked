// components/DutyRosterClient.tsx
// One flat, assignable list of every recurring duty for a property.
//
// Three things here are load-bearing and easy to break later:
//
// 1. THE FREQUENCY LIST IS BUILT FROM DATA, NEVER HARDCODED. An earlier spec
//    fixed it to ten labels and that hid 47 of 141 tasks -- Lax has zero Daily
//    tasks and thirteen frequencies, Main has 61 Daily and one Weekly. Any
//    fixed list is wrong for one of them.
// 2. THE EREV SHABBOS RULE keys off frequencies.recurrence_kind, not label
//    names, so a mislabelled row can't put "bake challah" on a Tuesday.
// 3. NULL ROOMS RENDER "—" AND STAY VISIBLE. 134 of 141 tasks have no room;
//    hiding them is why the old roster showed "no rows" on an empty filter.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { storageThumbnail } from '@/lib/storage-image';
import { routes } from '@/lib/app-routes';
import { ChevronDown, ClipboardList, Library } from 'lucide-react';

type Frequency = {
  id: string;
  code: string;
  label_en: string;
  label_es: string;
  recurrence_kind: string;
  sort_order: number;
};
// SS-273 floor filter. floor has no _es sibling in the schema (confirmed
// live -- only one column) and only three real values exist, so a small
// static display map covers it rather than a migration, same shape as the
// staples category translation added earlier.
const FLOOR_ES: Record<string, string> = {
  Basement: 'Sótano',
  'Main Floor': 'Planta Principal',
  Upstairs: 'Piso Superior',
};
// Fixed order, not alphabetical -- alphabetical happens to match here
// (Basement, Main Floor, Upstairs) but that is a coincidence of these
// specific names, not something to depend on if a fourth floor is ever
// added with a name that sorts oddly.
const FLOOR_ORDER = ['Basement', 'Main Floor', 'Upstairs'];

type Room = { id: string; name_en: string; name_es: string; floor: string | null };
// SS-131: assignment is to a PERSON. task_assignments.member_id is an FK to
// property_members.id; there is no assigned_slot_id and staff_slots are not in
// this path (SS-243 parked for exactly that reason).
type Member = { id: string; user_id: string; full_name: string | null };
type Assignment = { id: string; task_id: string; member_id: string | null };
type Task = {
  id: string;
  task_number: string;
  room_id: string | null;
  frequency_id: string | null;
  task_en: string;
  task_es: string;
  job_type: string | null;
  assigned_role: string | null;
  source_area_en: string | null;
  source_area_es: string | null;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
};

// The linked SOP, embedded on master_task_sops. sop_id is a many-to-one
// FK so PostgREST returns an object, but the generated types model it as
// an array -- and guessing wrong there fails silently (no poster, no
// text, no error), so both shapes are accepted.
type SopEmbed = {
  id: string;
  expected_appearance_url: string | null;
  sop_en: string | null;
  sop_es: string | null;
} | null;
type SopLinkRow = { master_task_id: string; sop_library: SopEmbed | SopEmbed[] };
type LinkedSop = { sopId: string; sopEn: string | null; sopEs: string | null };
type SopLibraryRow = {
  id: string;
  sop_code: string | null;
  zone_type: string | null;
  task_en: string;
  task_es: string;
  default_frequency_id: string | null;
};

const UNASSIGNED = 'Unassigned';
const NO_ROOM = '__noroom__';

// Areas whose work is not room-shaped: you maintain the boiler, watch the
// children, sweep the patio. A null room_id on one of these is correct
// data, not a gap to chase -- so they are excluded from Rooms Missing
// rather than counted and quietly ignored.
//
// This must stay in step with the select below: source_area_en was NOT
// fetched before this change, and a filter on a field the query never
// returns matches nothing while looking entirely reasonable.
const NON_ROOM_AREAS = ['Maintenance', 'Childcare', 'Outdoors'];

export default function DutyRosterClient({ propertyId }: { propertyId: string }) {
  const t = useTranslations('dutyRoster');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sopCounts, setSopCounts] = useState<Record<string, number>>({});
  const [posterByTask, setPosterByTask] = useState<Record<string, string>>({});
  const [sopTextByTask, setSopTextByTask] = useState<Record<string, LinkedSop>>({});
  const [sopLibrary, setSopLibrary] = useState<SopLibraryRow[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [deployBusyId, setDeployBusyId] = useState<string | null>(null);
  const [deployRoom, setDeployRoom] = useState<Record<string, string>>({});
  const [deployMember, setDeployMember] = useState<Record<string, string>>({});
  // Which tile has its procedure open. One at a time -- a grid with every
  // panel expanded is not a grid any more.
  const [openSopTaskId, setOpenSopTaskId] = useState<string | null>(null);
  // Retired (active=false) tasks are out of scope by default -- see the
  // scopedTasks note below.
  const [showRetired, setShowRetired] = useState(false);
  // Which room sections are collapsed. Sections start expanded, so an empty
  // set is the correct initial state -- this is the inverse of the Shopping
  // List, which seeds "everything collapsed" because it can hold 124 items
  // in one bucket. Here the sections themselves are the structure.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  // SS-273. 'all' is the default per spec -- distinct from `room`, which
  // narrows to one room; this narrows to a whole floor's worth of rooms.
  const [floor, setFloor] = useState('all');
  const [room, setRoom] = useState('all');
  const [job, setJob] = useState('all');
  const [freq, setFreq] = useState('all');
  const [assignment, setAssignment] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const settled = await Promise.allSettled([
      supabase
        .from('master_tasks')
        .select('id, task_number, room_id, frequency_id, task_en, task_es, job_type, assigned_role, source_area_en, source_area_es, photo_url, active, sort_order')
        .eq('property_id', propertyId)
        .order('sort_order'),
      supabase.from('frequencies').select('id, code, label_en, label_es, recurrence_kind, sort_order').order('sort_order'),
      supabase.from('rooms').select('id, name_en, name_es, floor').eq('property_id', propertyId).order('sort_order'),
      supabase
        .from('property_members')
        .select('id, user_id, profiles(full_name)')
        .eq('property_id', propertyId),
      // Already fetched for the SOP count; the poster and the procedure
      // text ride along on the same query rather than costing a second
      // round trip. Ordered so the first row per task is its primary SOP.
      supabase
        .from('master_task_sops')
        .select('master_task_id, sop_library(id, expected_appearance_url, sop_en, sop_es)')
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
      // Only live assignments. Ended ones stay on the table as history.
      supabase.from('task_assignments').select('id, task_id, member_id').eq('active', true),
      // Deploy-from-library, folded in from Task Center: adding tasks to a
      // property is an admin action and belongs on the manager's page.
      supabase
        .from('sop_library')
        .select('id, sop_code, zone_type, task_en, task_es, default_frequency_id')
        .eq('active', true)
        .order('zone_type')
        .order('task_en'),
    ]);

    // One failing source must not blank the page, and an error must never be
    // rendered as "nothing here" -- that is how a working screen looks broken.
    const failed: string[] = [];
    const rows = settled.map((s, i) => {
      if (s.status === 'rejected') {
        failed.push(String(i));
        return [] as unknown[];
      }
      const res = s.value as { data: unknown; error: unknown };
      if (res?.error) {
        failed.push(String(i));
        return [] as unknown[];
      }
      return (res?.data as unknown[]) ?? [];
    });

    setTasks(rows[0] as Task[]);
    setFrequencies(rows[1] as Frequency[]);
    setRooms(rows[2] as Room[]);
    setMembers(
      (rows[3] as { id: string; user_id: string; profiles: unknown }[]).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: (m.profiles as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );

    // One pass over the SOP links produces all three things the tiles
    // need: how many SOPs a task has, its poster, and its procedure text.
    //
    // Poster and text are accumulated separately on purpose. The poster
    // may come from a later link when the primary SOP has no picture; the
    // TEXT must not, or a tile would show one procedure's words beside a
    // different procedure's photo.
    const counts: Record<string, number> = {};
    const posters: Record<string, string> = {};
    const sopTexts: Record<string, LinkedSop> = {};
    (rows[4] as unknown as SopLinkRow[]).forEach((r) => {
      counts[r.master_task_id] = (counts[r.master_task_id] ?? 0) + 1;
      const embed = Array.isArray(r.sop_library) ? r.sop_library[0] ?? null : r.sop_library;
      if (!embed) return;
      if (embed.expected_appearance_url && !posters[r.master_task_id]) {
        posters[r.master_task_id] = embed.expected_appearance_url;
      }
      if (!sopTexts[r.master_task_id]) {
        sopTexts[r.master_task_id] = { sopId: embed.id, sopEn: embed.sop_en, sopEs: embed.sop_es };
      }
    });
    setSopCounts(counts);
    setPosterByTask(posters);
    setSopTextByTask(sopTexts);
    setAssignments(rows[5] as Assignment[]);
    setSopLibrary(rows[6] as SopLibraryRow[]);
    setLoadError(failed.length > 0 ? t('loadPartial') : null);
    setLoading(false);
  }, [propertyId, supabase, t]);

  useEffect(() => {
    load();
  }, [load]);

  const freqById = useMemo(() => new Map(frequencies.map((f) => [f.id, f])), [frequencies]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const roomLabel = (id: string | null) => {
    if (!id) return '—';
    const r = roomById.get(id);
    if (!r) return '—';
    return es ? r.name_es : r.name_en;
  };
  const freqLabel = (f: Frequency | undefined) => (f ? (es ? f.label_es : f.label_en) : '—');

  // Character-identical task text that lost its room or person on import. NOT
  // errors -- each belonged to a different scope. They are shown, never merged,
  // and flagged so they can be given a room or a slot.
  const duplicateText = useMemo(() => {
    const seen = new Map<string, number>();
    tasks.forEach((x) => seen.set(x.task_en, (seen.get(x.task_en) ?? 0) + 1));
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [tasks]);

  const needsScoping = (x: Task) => duplicateText.has(x.task_en) && x.room_id === null;

  // SS-131: assignment now lives in task_assignments, not in the free-text
  // assigned_role column. My Day reads task_assignments (SS-242), so anything
  // written to assigned_role never reached the person it was assigned to.
  const assignmentByTask = useMemo(() => {
    const m = new Map<string, Assignment>();
    assignments.forEach((a) => {
      if (a.member_id) m.set(a.task_id, a);
    });
    return m;
  }, [assignments]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const memberName = (memberId: string | null | undefined) => {
    if (!memberId) return null;
    return memberById.get(memberId)?.full_name ?? null;
  };

  const isUnassigned = (x: Task) => !assignmentByTask.has(x.id);

  // --- THE EREV SHABBOS RULE ------------------------------------------------
  // Selecting a non-Hebrew frequency drops every Hebrew-calendar task, even one
  // whose own frequency row says "Daily". Checking the label alone would let a
  // single bad row surface Erev Shabbos work on a weekday.
  const passesFrequency = useCallback(
    (x: Task) => {
      if (freq === 'all') return true;
      const own = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
      const selected = frequencies.find((f) => f.id === freq);
      if (selected && selected.recurrence_kind !== 'hebrew' && own?.recurrence_kind === 'hebrew') return false;
      return x.frequency_id === freq;
    },
    [freq, freqById, frequencies]
  );

  const matchAssignment = (x: Task) =>
    assignment === 'all' || (assignment === 'unassigned' ? isUnassigned(x) : !isUnassigned(x));
  const matchRoom = (x: Task) => room === 'all' || (room === NO_ROOM ? x.room_id === null : x.room_id === room);
  // A null-room task has no floor either -- roomById.get(null) misses and
  // ?. short-circuits to undefined, which never equals a real floor name,
  // so these tasks correctly drop out of any specific floor and only
  // appear under "All floors".
  const matchFloor = (x: Task) => floor === 'all' || roomById.get(x.room_id ?? '')?.floor === floor;
  const matchJob = (x: Task) => job === 'all' || (x.job_type ?? '') === job;
  const matchSearch = (x: Task) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [x.task_en, x.task_es, roomLabel(x.room_id), x.job_type ?? ''].join(' ').toLowerCase().includes(q);
  };

  // SS-309. `active` was selected into Task and then never read anywhere --
  // not in the query, not client-side. So retired rows rendered as tiles
  // and counted in every stat: five Childcare duplicates from a July 19
  // batch insert, each pair already correctly one active + one inactive,
  // inflating "Total" by five.
  //
  // Scoped ONCE here rather than filtered at each call site, so the stats,
  // the dropdown option lists and the tile grid cannot disagree about what
  // they are counting. Everything downstream reads scopedTasks.
  //
  // Not hidden outright: this page is owner/manager only, and an admin is
  // exactly who might need to find a retired task to reactivate it.
  // Hiding them with no way back would trade a visible wrong number for an
  // invisible missing row.
  const scopedTasks = useMemo(
    () => (showRetired ? tasks : tasks.filter((x) => x.active)),
    [tasks, showRetired]
  );
  const retiredCount = useMemo(() => tasks.filter((x) => !x.active).length, [tasks]);

  // Cross-narrowing: each dropdown is built from what the OTHER filters leave,
  // so no combination can be assembled that returns nothing.
  const freqOptions = useMemo(() => {
    const present = new Set(
      scopedTasks
        .filter((x) => matchFloor(x) && matchRoom(x) && matchJob(x) && matchAssignment(x) && matchSearch(x))
        .map((x) => x.frequency_id)
    );
    return frequencies.filter((f) => present.has(f.id));
  }, [scopedTasks, frequencies, floor, room, job, assignment, search]);

  const roomOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchFloor(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    const ids = new Set(pool.map((x) => x.room_id));
    return { hasNull: ids.has(null), list: rooms.filter((r) => ids.has(r.id)) };
  }, [scopedTasks, rooms, floor, job, freq, assignment, search, passesFrequency]);

  const jobOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchFloor(x) && matchRoom(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    return [...new Set(pool.map((x) => x.job_type).filter(Boolean))].sort() as string[];
  }, [scopedTasks, floor, room, freq, assignment, search, passesFrequency]);

  const filtered = useMemo(
    () => scopedTasks.filter((x) => matchFloor(x) && matchRoom(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x)),
    [scopedTasks, floor, room, job, freq, assignment, search, passesFrequency]
  );

  // Room sections. Label is the room name when room_id is set, otherwise the
  // task's source area -- every null-room task has one (checked live: 24 of
  // 124 on Main have no room, 0 of those lack an area), so there is no
  // "everything else" bucket to design around.
  //
  // Built from `filtered`, not from tasks, so every existing filter keeps
  // working untouched: a section only exists if something in it survived the
  // filters, which is also why zero-match sections disappear rather than
  // needing to be hidden.
  //
  // Sorted by the label the viewer actually sees, using localeCompare with
  // the active locale. The brief said A-Z by task_en, but sorting Spanish
  // text by its English original produces an order that looks scrambled to
  // the person reading it -- and accented characters need locale-aware
  // collation regardless.
  const sections = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const x of filtered) {
      const room = x.room_id ? roomById.get(x.room_id) : null;
      const label = room
        ? (es ? room.name_es || room.name_en : room.name_en)
        : (es ? x.source_area_es || x.source_area_en : x.source_area_en) || t('noRoom');
      const list = map.get(label);
      if (list) list.push(x);
      else map.set(label, [x]);
    }
    return [...map.entries()]
      .map(([label, items]) => ({
        label,
        items: [...items].sort((a, b) =>
          (es ? a.task_es || a.task_en : a.task_en).localeCompare(
            es ? b.task_es || b.task_en : b.task_en,
            locale
          )
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [filtered, roomById, es, locale, t]);

  // Every room for this property, A-Z, for the inline room editor. Distinct
  // from `roomOptions` above, which is deliberately narrowed by the other
  // filters -- you must be able to move a task INTO a room that the current
  // filter would otherwise hide.
  const roomOptionsAZ = useMemo(
    () => [...rooms].sort((a, b) => (es ? a.name_es || a.name_en : a.name_en).localeCompare(es ? b.name_es || b.name_en : b.name_en, locale)),
    [rooms, es, locale]
  );

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Derived from `filtered`, so the tiles answer "of what I'm looking at
  // right now" and move as the filters move. That is the whole reason they
  // stayed in this component rather than being hoisted into a page shell.
  const stats = useMemo(
    () => ({
      total: filtered.length,
      unassigned: filtered.filter(isUnassigned).length,
      withSop: filtered.filter((x) => (sopCounts[x.id] ?? 0) > 0).length,
      roomsMissing: filtered.filter(
        (x) => x.room_id === null && !NON_ROOM_AREAS.includes(x.source_area_en ?? '')
      ).length,
    }),
    [filtered, sopCounts]
  );

  // SS-273. Fixed order (not alphabetical, not sort_order) so the tab row
  // reads Basement -> Main Floor -> Upstairs regardless of how individual
  // rooms happen to be ordered within each floor. Only real, present floor
  // values -- a property with no floor data on any room shows no tab row
  // at all rather than an empty one.
  const allFloorNames = FLOOR_ORDER.filter((f) => rooms.some((r) => r.floor === f));
  const floorLabel = (f: string) => (es && FLOOR_ES[f] ? FLOOR_ES[f] : f);

  // floor is deliberately excluded from filtersActive/clearFilters -- it is
  // a top-level view tab, same role Inventory's own floor tabs play there,
  // not one of the filter pills a person "clears." Persists across a clear
  // the same way switching floors on Inventory does.
  const filtersActive =
    search.trim() !== '' || room !== 'all' || job !== 'all' || freq !== 'all' || assignment !== 'all';

  function clearFilters() {
    setSearch('');
    setRoom('all');
    setJob('all');
    setFreq('all');
    setAssignment('all');
  }

  // Same shape as StaffTasksClient.assignMember -- one mechanism, not two.
  // Effective-dated reassignment: the current row is deactivated and stamped
  // with effective_to, never deleted, which is what active/effective_from/
  // effective_to on this table are for (R21).
  //
  // assigned_role is deliberately left alone. Not dropped, not cleared -- just
  // no longer written. It is null on every active task, so nothing is lost.
  // Folded in from Task Center, unchanged in behaviour: the same
  // deploy_sop_to_property RPC with the same arguments. Reloads on success
  // because a deployed SOP becomes a new master_task and the grid, the
  // filters and the stat tiles all have to see it.
  async function deploySop(sop: SopLibraryRow) {
    setDeployBusyId(sop.id);
    const roomId = deployRoom[sop.id] ?? '';
    const roomNameEn = roomId ? rooms.find((r) => r.id === roomId)?.name_en ?? null : null;
    const { error } = await supabase.rpc('deploy_sop_to_property', {
      p_sop_id: sop.id,
      p_property_id: propertyId,
      p_room_name_en: roomNameEn,
      p_member_id: deployMember[sop.id] || null,
    });
    setDeployBusyId(null);
    if (error) {
      setLoadError(error.message || t('saveFailed'));
      return;
    }
    load();
  }

  // SS-130: the room eyebrow was display-only, which is what made
  // "Rooms Missing" a number you could read but not act on. Owner/manager
  // only by construction -- this whole page redirects staff out.
  //
  // Optimistic: the tile (and the section it sits in) moves immediately,
  // then rolls back to the loaded state if the write fails. Changing a room
  // re-buckets the task, because `sections` derives from the same task list
  // rather than caching its own copy.
  async function setTaskRoom(taskId: string, roomId: string | null) {
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, room_id: roomId } : x)));
    const { error } = await supabase.from('master_tasks').update({ room_id: roomId }).eq('id', taskId);
    if (error) {
      setTasks(previous);
      setLoadError(t('saveFailed'));
    }
  }

  // Retired tasks are reachable behind the filter (SS-309) but there was no
  // way back from there. R21 says deprecate rather than delete, which only
  // works if un-deprecating is possible.
  async function reactivateTask(taskId: string) {
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, active: true } : x)));
    const { error } = await supabase.from('master_tasks').update({ active: true }).eq('id', taskId);
    if (error) {
      setTasks(previous);
      setLoadError(t('saveFailed'));
    }
  }

  async function assign(taskId: string, memberId: string) {
    const existing = assignmentByTask.get(taskId);
    if (existing && existing.member_id === memberId) return;

    if (existing) {
      const { error } = await supabase
        .from('task_assignments')
        .update({ active: false, effective_to: new Date().toISOString().slice(0, 10) })
        .eq('id', existing.id);
      if (error) {
        setLoadError(t('saveFailed'));
        return;
      }
    }

    // Empty selection means "unassign": the old row is closed out above and no
    // new one is opened.
    if (!memberId) {
      setAssignments((prev) => prev.filter((a) => a.task_id !== taskId));
      return;
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .insert({ task_id: taskId, member_id: memberId })
      .select('id, task_id, member_id')
      .single();
    if (error || !data) {
      setLoadError(t('saveFailed'));
      load(); // never leave the screen claiming a save that failed
      return;
    }
    setAssignments((prev) => [...prev.filter((a) => a.task_id !== taskId), data as Assignment]);
  }

  // Real people from property_members, never a hardcoded name (R17). A member
  // with no profile row still gets an option rather than disappearing from the
  // list -- unnamed is a data gap, not a reason to be unassignable.
  const assignees = useMemo(
    () => members.map((m) => ({ id: m.id, label: m.full_name ?? t('unnamedMember') })),
    [members, t]
  );

  const pill =
    'appearance-none bg-card border border-cardBorder rounded-full px-3 py-1.5 text-[12px] text-denim';

  // Outer container removed (SS-156 Phase 2) -- the page frame owns the
  // background and max-width now, so the Tasks and Roster tabs stop
  // changing width and colour as you switch. The standalone
  // /staff/duty-roster route supplies the same frame itself.
  //
  // The stat tiles moved up into TaskCenterTabs so they are visible on
  // both tabs rather than only this one. Their computation (`stats`, from
  // `filtered`) is still here and untouched -- see the note above it.
  return (
    <>
      <h1 className="font-display text-[34px] font-normal text-denim">{t('title')}</h1>
      <p className="text-[13px] text-dusk mb-5">{t('subtitle')}</p>

      {loadError && (
        <p className="mb-4 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{loadError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { k: 'statTotal', v: stats.total },
          { k: 'statUnassigned', v: stats.unassigned },
          { k: 'statWithSop', v: stats.withSop },
          // Carries a hint because a zero here is a real answer, not an
          // empty one: without saying why, "Rooms Missing 0" looks like the
          // count is broken. Rendered as a caption as well as a title
          // attribute -- a hover-only tooltip tells a phone user nothing.
          { k: 'statRoomsMissing', v: stats.roomsMissing, hint: t('statRoomsMissingHint') },
        ].map((s) => (
          <div
            key={s.k}
            title={s.hint}
            className="relative bg-card border border-cardBorder rounded-xl2 shadow-card p-4"
          >
            <PinDot />
            <p className="text-[12px] text-dusk">{t(s.k)}</p>
            <p className="font-display text-[24px] text-denim leading-tight mt-0.5">{s.v}</p>
            {s.hint && <p className="text-[10px] text-dusk leading-snug mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* Deploy from the task library. Folded in from Task Center because
          adding tasks to a property is an admin action and this is now the
          only page a manager needs for the roster. Collapsed by default --
          it is a periodic action, not the reason you opened the page. */}
      <div className="mb-4 rounded-xl2 border border-cardBorder bg-card shadow-card overflow-hidden">
        <button
          onClick={() => setShowLibrary((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <Library size={16} className="text-brass shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="flex-1 font-display text-denim">{t('deployFromLibrary')}</span>
          <span className="text-xs text-dusk">({sopLibrary.length})</span>
          <ChevronDown
            size={16}
            className={`text-dusk transition-transform ${showLibrary ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {showLibrary && (
          <div className="border-t border-cardBorder p-4 space-y-2 max-h-[28rem] overflow-y-auto">
            {sopLibrary.map((sop) => (
              <div key={sop.id} className="rounded-xl bg-mist p-2.5">
                <p className="text-sm text-denim mb-1.5">{es ? sop.task_es : sop.task_en}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={deployRoom[sop.id] ?? ''}
                    onChange={(e) => setDeployRoom((p) => ({ ...p, [sop.id]: e.target.value }))}
                    className={pill}
                  >
                    <option value="">{t('noRoom')}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {es ? r.name_es : r.name_en}
                      </option>
                    ))}
                  </select>
                  <select
                    value={deployMember[sop.id] ?? ''}
                    onChange={(e) => setDeployMember((p) => ({ ...p, [sop.id]: e.target.value }))}
                    className={pill}
                  >
                    <option value="">{t('unassigned')}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name ?? t('unnamedMember')}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deploySop(sop)}
                    disabled={deployBusyId === sop.id}
                    className="text-xs font-medium bg-denim text-white px-3 py-1.5 rounded-full disabled:opacity-40"
                  >
                    {deployBusyId === sop.id ? t('adding') : t('addToList')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SS-273 floor tabs -- same bg-mist pill-strip treatment Inventory
          already uses for its own floor tabs (InventoryClient.tsx), so the
          two pages read as the same pattern rather than two designs for
          the same idea. Hidden when there is only one real floor value (or
          none), same guard Inventory applies, since a single-option tab row
          filters nothing. */}
      {allFloorNames.length > 1 && (
        <div className="flex items-center gap-1 bg-mist rounded-full p-1 flex-wrap mb-3 w-fit">
          <button
            onClick={() => setFloor('all')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              floor === 'all' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            {t('allFloors')}
          </button>
          {allFloorNames.map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                floor === f ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {floorLabel(f)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="bg-card border border-cardBorder rounded-full px-4 py-2 text-[13px] text-denim placeholder:text-dusk"
        />
        <select className={pill} value={room} onChange={(e) => setRoom(e.target.value)} aria-label={t('filterRooms')}>
          <option value="all">{t('allRooms')}</option>
          {roomOptions.hasNull && <option value={NO_ROOM}>{t('noRoom')}</option>}
          {roomOptions.list.map((r) => (
            <option key={r.id} value={r.id}>
              {es ? r.name_es : r.name_en}
            </option>
          ))}
        </select>
        <select className={pill} value={job} onChange={(e) => setJob(e.target.value)} aria-label={t('filterJobs')}>
          <option value="all">{t('allJobs')}</option>
          {jobOptions.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        {/* Built from the frequencies table at runtime, scoped to what this
            property actually uses. Never a fixed list. */}
        <select className={pill} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label={t('filterFrequencies')}>
          <option value="all">{t('allFrequencies')}</option>
          {freqOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {es ? f.label_es : f.label_en}
            </option>
          ))}
        </select>
        <select
          className={pill}
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          aria-label={t('filterAssignment')}
        >
          <option value="all">{t('allAssignment')}</option>
          <option value="unassigned">{t('unassigned')}</option>
          <option value="assigned">{t('assigned')}</option>
        </select>

        {/* The way back to retired tasks. Only offered when there are any --
            a toggle that reveals nothing is just a question mark. Sits with
            the other filters because that is what it is: a scope control,
            not a setting. */}
        {retiredCount > 0 && (
          <label className="inline-flex items-center gap-2 text-[12px] text-denim cursor-pointer">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
              className="h-4 w-4 accent-brass rounded"
            />
            {t('showRetired', { count: retiredCount })}
          </label>
        )}
      </div>

      <div className="relative bg-card border border-cardBorder rounded-xl3 shadow-card overflow-hidden">
        <PinDot />
        <div className="bg-denim py-[11px] px-5">
          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white">
            {t('stripSummary', {
              count: filtered.length,
              scope: freq === 'all' ? t('allFrequencies') : freqLabel(frequencies.find((f) => f.id === freq)),
            })}
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-center py-14 text-[13px] text-dusk">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              {/* Two distinct empty states, never one. Country has 0 tasks and
                  will hit the second on day one -- it must read as intentional. */}
              <p className="font-display text-[18px] text-denim">
                {filtersActive ? t('emptyFiltered') : t('emptyNoDuties')}
              </p>
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="mt-3 bg-denim text-white text-[13px] rounded-full px-5 py-2.5 shadow-card"
                >
                  {t('clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => {
                const sectionCollapsed = collapsedSections.has(section.label);
                return (
                  <div key={section.label}>
                    {/* Denim strip header, room name left, count right, pin
                        dot top-right (D-03). The whole strip is the toggle,
                        matching the Shopping List's tap-the-header pattern
                        rather than introducing a chevron (D-21). */}
                    <button
                      onClick={() => toggleSection(section.label)}
                      aria-expanded={!sectionCollapsed}
                      className="relative w-full flex items-center justify-between gap-3 bg-denim rounded-xl2 py-[11px] pl-5 pr-8 mb-[14px] text-left"
                    >
                      <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white truncate">
                        {section.label}
                      </span>
                      <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 shrink-0">
                        {section.items.length}
                      </span>
                      <PinDot />
                    </button>

                    {!sectionCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[14px]">
                        {section.items.map((x) => {
                const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
                const unassigned = isUnassigned(x);
                const sops = sopCounts[x.id] ?? 0;
                const tileImage = x.photo_url ?? posterByTask[x.id] ?? null;
                const linked = sopTextByTask[x.id] ?? null;
                // Falls back to the other language rather than showing an
                // empty panel: English instructions beat no instructions.
                const sopText = linked ? (es ? linked.sopEs ?? linked.sopEn : linked.sopEn ?? linked.sopEs) : null;
                const sopOpen = openSopTaskId === x.id;
                return (
                  <div
                    key={x.id}
                    className="relative bg-mist rounded-xl2 shadow-card hover:shadow-cardHover transition-shadow flex flex-col justify-between py-[14px] px-[18px]"
                    style={{
                      minHeight: 184,
                      border: `1px solid ${unassigned ? 'rgba(198,164,110,0.3)' : 'rgba(46,74,98,0.2)'}`,
                    }}
                  >
                    <PinDot />
                    <div>
                      <div className="flex items-start justify-between gap-2 pr-4">
                        {/* SS-130: the room is editable in place now. Styled
                            to read as the eyebrow it replaces -- no border,
                            no chrome -- so the tile looks unchanged until
                            you interact with it. appearance-none because a
                            native caret here would read as decoration on an
                            uppercase micro-label. */}
                        <span className="flex items-center gap-1 min-w-0">
                          <select
                            value={x.room_id ?? ''}
                            onChange={(e) => setTaskRoom(x.id, e.target.value || null)}
                            aria-label={t('changeRoom')}
                            className="appearance-none bg-transparent cursor-pointer text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate max-w-[120px] hover:underline underline-offset-2"
                          >
                            <option value="">{t('noRoom')}</option>
                            {roomOptionsAZ.map((r) => (
                              <option key={r.id} value={r.id}>
                                {es ? r.name_es || r.name_en : r.name_en}
                              </option>
                            ))}
                          </select>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate">
                            • {x.job_type ?? '—'}
                          </span>
                        </span>
                        <span className="shrink-0 text-[8px] uppercase tracking-[0.15em] bg-card border border-cardBorder text-dusk px-2 py-0.5 rounded-full">
                          {freqLabel(f)}
                        </span>
                      </div>

                      {/* Task illustration first (what this job is), else
                          the linked SOP's poster (what finished looks
                          like). Different meanings, never conflated -- the
                          task's own photo wins. Nothing renders when there
                          is neither, rather than a grey placeholder on most
                          tiles. Resized: these are full-size images and a
                          grid draws many at once. */}
                      <div className="flex items-start gap-2.5 mt-2">
                        {tileImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storageThumbnail(tileImage, 96)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="shrink-0 h-12 w-12 rounded-lg object-cover bg-card"
                          />
                        )}
                        <p
                          className="flex-1 min-w-0 font-display text-[15px] text-denim"
                          style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          title={es ? x.task_es : x.task_en}
                        >
                          {es ? x.task_es : x.task_en}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Only ever visible when the retired filter is on,
                            since inactive rows are otherwise out of scope --
                            but then it must be unmistakable which tiles are
                            the retired ones. */}
                        {!x.active && (
                          <>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk border border-cardBorder rounded-full px-2 py-0.5">
                              {t('retiredBadge')}
                            </span>
                            {/* The way back. R21's "deprecate, don't delete"
                                only holds up if un-deprecating is possible
                                from the same screen that hid it. */}
                            <button
                              onClick={() => reactivateTask(x.id)}
                              className="text-[9px] font-semibold uppercase tracking-[0.15em] text-denim underline-offset-2 hover:underline"
                            >
                              {t('reactivate')}
                            </button>
                          </>
                        )}
                        {sops > 0 && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brass">
                            {t('sopCount', { count: sops })}
                          </span>
                        )}
                        {needsScoping(x) && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                            {t('needsScoping')}
                          </span>
                        )}
                      </div>

                      {/* The full procedure, inline. Collapsed by default so
                          the grid stays a grid; open one and it expands in
                          place. No navigation away -- the whole point of
                          SS-300 was that the procedure reaches the person
                          looking at the task. */}
                      {sopText && (
                        <>
                          <button
                            onClick={() => setOpenSopTaskId(sopOpen ? null : x.id)}
                            aria-expanded={sopOpen}
                            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass"
                          >
                            <ClipboardList size={11} strokeWidth={1.75} aria-hidden="true" />
                            {sopOpen ? t('hideProcedure') : t('showProcedure')}
                          </button>
                          {sopOpen && (
                            <div className="mt-2 rounded-xl bg-card border border-cardBorder p-2.5 space-y-2">
                              {/* Authored as multi-step instructions with
                                  real line breaks; collapsing them into one
                                  paragraph makes a procedure unreadable. */}
                              <p className="text-[11px] text-denim whitespace-pre-line leading-relaxed">
                                {sopText}
                              </p>
                              {posterByTask[x.id] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={storageThumbnail(posterByTask[x.id], 640)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full max-h-48 object-contain rounded-lg bg-mist"
                                />
                              )}
                              {/* Opens the SOP Library scrolled to and
                                  expanded on this exact SOP -- the
                                  ?sop=<id> deep link added for this. New
                                  tab on purpose: the inline text above
                                  exists so nobody loses their place in the
                                  roster, and a same-tab link would undo
                                  that. rel is required with target _blank
                                  so the opened page cannot reach back
                                  through window.opener. */}
                              {linked?.sopId && (
                                <a
                                  href={routes.sops(propertyId, linked.sopId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-[11px] font-medium text-brass underline-offset-2 hover:underline"
                                >
                                  {t('viewFullProcedure')}
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="-mx-[18px] -mb-[14px] mt-2 bg-card px-[18px] py-2 flex justify-between items-center rounded-b-xl2 border-t border-cardBorder">
                      {unassigned ? (
                        <span className="w-5 h-5 rounded-full border border-dashed border-dusk text-dusk text-[10px] flex items-center justify-center shrink-0">
                          ?
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-denim text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {(memberName(assignmentByTask.get(x.id)?.member_id) ?? '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                      <select
                        className="appearance-none bg-white border border-cardBorder rounded-full px-3 py-1.5 text-[11px] text-denim truncate max-w-[110px]"
                        value={assignmentByTask.get(x.id)?.member_id ?? ''}
                        onChange={(e) => assign(x.id, e.target.value)}
                        aria-label={t('assignTo')}
                      >
                        {/* Reads as an action when there is something to
                            remove, and as a placeholder when there isn't --
                            "Unassigned" sitting above a list of names looks
                            like another person rather than a verb. */}
                        <option value="">
                          {unassigned ? t('unassigned') : t('removeAssignment')}
                        </option>
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>
                        </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Pin dot -- every card, no exceptions.
function PinDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        top: 11,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 9999,
        background: 'radial-gradient(circle at 36% 30%, #F8E8B8 0%, #C6A46E 52%, #7A4E18 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,.26), inset 0 .5px .5px rgba(255,255,255,.3)',
      }}
    />
  );
}
